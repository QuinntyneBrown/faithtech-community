#Requires -Version 7.2
<#
.SYNOPSIS
    Records the narrated journey videos in docs/videos/journeys.

.DESCRIPTION
    For each journey: synthesizes one edge-tts clip per narration paragraph, records one take of
    the running app with Playwright (eng/videos/playwright.config.ts) while holding each caption for
    its clip, lays the clips against the logged caption times, muxes the Opus track and chapters
    into the WebM without re-encoding the video, writes WebVTT captions and a poster, checks the
    result with ffprobe and only then copies it into docs/videos/journeys.

    The app runs against the e2e fake API (e2e/fixtures/mock-api.ts); every detail is synthetic.
    Temporary files go to eng/videos/.run, which git ignores.

.PARAMETER Journey
    Slugs to record. Defaults to every journey.

.PARAMETER Missing
    Record only the journeys that have no video.webm yet.

.PARAMETER Engine
    The narration voice: edge (default; edge-tts, EDGE_VOICE) or kokoro (Kokoro-82M ONNX, run
    locally; KOKORO_VOICE, default af_heart, at KOKORO_SPEED, default 1.0). Kokoro needs
    `pip install kokoro-onnx soundfile` and the onnx-community/Kokoro-82M-v1.0-ONNX model in the
    Hugging Face cache or KOKORO_MODEL_DIR (ADR 0037).

.PARAMETER NoCaptions
    Show no on-screen caption and write no captions.vtt. Chapters stay in the WebM; narration.md is
    the transcript. Off by default, so existing journeys record as before.

.PARAMETER Music
    Mix a quiet instrumental bed under the narration: faded in and out, ducked under the voice and
    cut to the video's length (ADR 0037). The track is downloaded into eng/videos/.run at record time
    and never committed. Off by default.

.EXAMPLE
    pwsh eng/videos/Record-JourneyVideos.ps1
.EXAMPLE
    pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-up
.EXAMPLE
    pwsh eng/videos/Record-JourneyVideos.ps1 -Journey create-event-hub -Engine kokoro -NoCaptions -Music
#>
[CmdletBinding()]
param(
    [string[]] $Journey,
    [switch] $Missing,
    [ValidateSet('edge', 'kokoro')] [string] $Engine = 'edge',
    [switch] $NoCaptions,
    [switch] $Music,
    [int] $Port = 4310
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$OutDir = Join-Path $Root 'docs' 'videos' 'journeys'
$RunDir = if ($env:DEMO_RUN_ROOT) { $env:DEMO_RUN_ROOT } else { Join-Path $PSScriptRoot '.run' }
$Python = if ($env:PYTHON) { $env:PYTHON } elseif ($IsWindows) { 'python' } else { 'python3' }
$Voice = if ($Engine -eq 'kokoro') {
    if ($env:KOKORO_VOICE) { $env:KOKORO_VOICE } else { 'af_heart' }
} elseif ($env:EDGE_VOICE) { $env:EDGE_VOICE } else { 'en-US-AndrewMultilingualNeural' }
$KokoroSpeed = if ($env:KOKORO_SPEED) { $env:KOKORO_SPEED } else { '1.0' }
# The music bed (ADR 0037): "Port of Spain Carnival Flow" from Pixabay, under the Pixabay Content
# License, which allows it in videos without attribution but not on its own, so it is never committed.
$MusicUrl = if ($env:DEMO_MUSIC_URL) { $env:DEMO_MUSIC_URL } else { 'https://cdn.pixabay.com/audio/2025/04/21/audio_226353a520.mp3' }
$MusicVolume = 0.22
# Speaks argv[1] with Kokoro-82M ONNX into argv[5] (24 kHz WAV): voice argv[2], speed argv[3], model folder argv[4].
$KokoroScript = @'
import os, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
text, voice, speed, model, out = sys.argv[1:6]
npz = out + '.voice.npz'
np.savez(npz, **{voice: np.fromfile(os.path.join(model, 'voices', voice + '.bin'), dtype=np.float32).reshape(-1, 1, 256)})
samples, rate = Kokoro(os.path.join(model, 'onnx', 'model.onnx'), npz).create(text, voice=voice, speed=float(speed), lang='en-us')
os.remove(npz)
sf.write(out, samples, rate)
'@
$MarginSeconds = 0.7
$AllJourneys = Get-ChildItem (Join-Path $PSScriptRoot 'journeys') -Filter '*.story.ts' |
    ForEach-Object { $_.Name -replace '\.story\.ts$', '' } | Sort-Object
# Accepts "-Journey a,b" from PowerShell and "-Journey a,b" passed as one string by other shells.
$Journey = if ($Journey) { $Journey -split ',' | ForEach-Object Trim | Where-Object { $_ } } else { $AllJourneys }
if ($Missing) { $Journey = @($Journey | Where-Object { -not (Test-Path (Join-Path $OutDir $_ 'video.webm')) }) }
if (-not $Journey) { Write-Host 'Nothing to record.'; return }
foreach ($slug in $Journey) {
    if ($slug -notin $AllJourneys) { throw "Unknown journey '$slug'. Choose from: $($AllJourneys -join ', ')" }
}

function Invoke-Tool {
    param([string] $File, [string[]] $Arguments)
    $output = & $File @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$File $($Arguments -join ' ') failed ($LASTEXITCODE):`n$($output | Out-String)"
    }
    return $output
}

function Test-Prerequisites {
    foreach ($tool in 'node', 'npm', 'ffmpeg', 'ffprobe', $Python) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing tool: $tool" }
    }
    $encoders = (Invoke-Tool ffmpeg @('-hide_banner', '-encoders')) | Out-String
    foreach ($codec in 'libopus', 'libvpx') {
        if ($encoders -notmatch $codec) { throw "ffmpeg lacks $codec" }
    }
    if ($Engine -eq 'kokoro') {
        & $Python -c 'import kokoro_onnx, soundfile' 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Kokoro is missing: $Python -m pip install kokoro-onnx soundfile" }
        if (-not (Test-Path (Join-Path (Get-KokoroModel) 'voices' "$Voice.bin"))) { throw "No Kokoro voice $Voice in $(Get-KokoroModel)" }
    } else {
        & $Python -c 'import edge_tts' 2>$null
        if ($LASTEXITCODE -ne 0) { throw "edge-tts is missing: $Python -m pip install edge-tts" }
    }
    if (-not (Test-Path (Join-Path $Root 'e2e' 'node_modules'))) {
        Invoke-Tool npm @('--prefix', (Join-Path $Root 'e2e'), 'ci') | Out-Null
    }
    if (-not (Test-Path (Join-Path $Root 'frontend' 'node_modules'))) {
        Invoke-Tool npm @('--prefix', (Join-Path $Root 'frontend'), 'ci') | Out-Null
    }
}

# The Kokoro-82M ONNX model folder (onnx/model.onnx and voices/*.bin).
function Get-KokoroModel {
    if ($env:KOKORO_MODEL_DIR) { return $env:KOKORO_MODEL_DIR }
    $hub = if ($env:HF_HOME) { Join-Path $env:HF_HOME 'hub' } else { Join-Path $HOME '.cache' 'huggingface' 'hub' }
    $snapshot = Get-ChildItem (Join-Path $hub 'models--onnx-community--Kokoro-82M-v1.0-ONNX' 'snapshots') -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'onnx' 'model.onnx') } | Select-Object -First 1
    if (-not $snapshot) {
        throw 'No Kokoro model: huggingface-cli download onnx-community/Kokoro-82M-v1.0-ONNX onnx/model.onnx voices/af_heart.bin, or set KOKORO_MODEL_DIR'
    }
    return $snapshot.FullName
}

# The music bed, downloaded once into the run folder and never committed (ADR 0037).
function Get-MusicBed {
    $file = Join-Path $RunDir 'music' 'bed.mp3'
    if (-not (Test-Path $file)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
        Invoke-WebRequest -Uri $MusicUrl -OutFile $file -UserAgent 'Mozilla/5.0'
    }
    return $file
}

function Get-Duration([string] $Path) {
    $text = Invoke-Tool ffprobe @('-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', $Path)
    return [double]::Parse(($text | Select-Object -First 1), [Globalization.CultureInfo]::InvariantCulture)
}

# Narration files: "# Title", then "## step-id: Chapter title" and one paragraph per step.
function Read-Narration([string] $Slug) {
    $lines = Get-Content -LiteralPath (Join-Path $OutDir $Slug 'narration.md') -Encoding utf8
    $title = ($lines | Where-Object { $_ -match '^# ' } | Select-Object -First 1) -replace '^# ', ''
    $clips = [Collections.Generic.List[object]]::new()
    $current = $null
    foreach ($line in $lines) {
        if ($line -match '^## ([a-z0-9-]+): (.+)$') {
            $current = [ordered]@{ id = $Matches[1]; chapter = $Matches[2]; text = '' }
            $clips.Add($current)
        } elseif ($current -and $line.Trim()) {
            $current.text = ("$($current.text) $($line.Trim())").Trim()
        }
    }
    if (-not $title -or $clips.Count -eq 0) { throw "$Slug/narration.md has no title or steps" }
    return [ordered]@{ slug = $Slug; title = $title; clips = $clips }
}

function ConvertTo-Spoken([string] $Text) {
    $lexicon = Get-Content -Raw (Join-Path $OutDir 'pronunciations.json') | ConvertFrom-Json -AsHashtable
    foreach ($key in $lexicon.Keys | Sort-Object Length -Descending) {
        $Text = $Text -replace [regex]::Escape($key), $lexicon[$key]
    }
    return $Text
}

function New-Narration([string] $Slug) {
    $dir = Join-Path $RunDir $Slug
    New-Item -ItemType Directory -Force -Path (Join-Path $dir 'clips') | Out-Null
    $manifest = Read-Narration $Slug
    foreach ($clip in $manifest.clips) {
        $spoken = ConvertTo-Spoken $clip.text
        $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
                [Text.Encoding]::UTF8.GetBytes($(if ($Engine -eq 'kokoro') { "kokoro|$Voice|$KokoroSpeed|$spoken" } else { "$Voice|$spoken" })))).Substring(0, 16)
        $wav = Join-Path $dir 'clips' "$($clip.id)-$hash.wav"
        if (-not (Test-Path $wav) -and $Engine -eq 'kokoro') {
            $raw = [IO.Path]::ChangeExtension($wav, '.24k.wav')
            Invoke-Tool $Python @('-c', $KokoroScript, $spoken, $Voice, $KokoroSpeed, (Get-KokoroModel), $raw) | Out-Null
            Invoke-Tool ffmpeg @('-y', '-v', 'error', '-i', $raw, '-ar', '48000', '-ac', '1', $wav) | Out-Null
            Remove-Item $raw
        }
        if (-not (Test-Path $wav)) {
            $mp3 = [IO.Path]::ChangeExtension($wav, '.mp3')
            # The online voice service occasionally answers with no audio; retry before failing.
            for ($attempt = 1; ; $attempt++) {
                try {
                    Invoke-Tool $Python @('-m', 'edge_tts', '--voice', $Voice, '--text', $spoken, '--write-media', $mp3) | Out-Null
                    break
                } catch {
                    if ($attempt -ge 4) { throw }
                    Start-Sleep -Seconds ([Math]::Pow(2, $attempt))
                }
            }
            Invoke-Tool ffmpeg @('-y', '-v', 'error', '-i', $mp3, '-ar', '48000', '-ac', '1', $wav) | Out-Null
            Remove-Item $mp3
        }
        $clip.wav = $wav
        $clip.duration = Get-Duration $wav
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $dir 'manifest.json')
    Write-Host ("{0}: {1} clips, {2:N1}s of narration" -f $Slug, $manifest.clips.Count,
        ($manifest.clips | ForEach-Object { $_.duration } | Measure-Object -Sum).Sum)
}

# The opening card is the first dark frame; its logged time against the video's gives the offset.
function Get-VideoOffset([string] $Video, [double] $OpeningLogged) {
    $stats = & ffmpeg -v error -t 15 -i $Video -vf 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-' -f null - 2>&1
    $time = $null
    foreach ($line in $stats) {
        if ($line -match 'pts_time:([0-9.]+)') { $time = [double]$Matches[1] }
        elseif ($line -match 'YAVG=([0-9.]+)' -and [double]$Matches[1] -lt 80) {
            return $time - $OpeningLogged
        }
    }
    throw "No opening card found in the first 15 seconds of $Video"
}

function Format-Time([double] $Seconds, [string] $Separator = '.') {
    $t = [TimeSpan]::FromSeconds([Math]::Max(0, $Seconds))
    return '{0:00}:{1:00}:{2:00}{3}{4:000}' -f [int][Math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds, $Separator, $t.Milliseconds
}

function Complete-Video([string] $Slug) {
    $dir = Join-Path $RunDir $Slug
    $stage = Join-Path $dir 'stage'
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    $manifest = Get-Content -Raw (Join-Path $dir 'manifest.json') | ConvertFrom-Json
    $timeline = Get-Content -Raw (Join-Path $dir 'timeline.json') | ConvertFrom-Json
    $raw = Join-Path $dir 'take.webm'
    # Playwright saves the page's video into the test's output folder once the context closes.
    $take = Get-ChildItem (Join-Path $RunDir 'playwright') -Directory -Filter "$Slug.story.ts-*" |
        Get-ChildItem -Filter 'video.webm' | Select-Object -First 1
    # Playwright shortens a long folder name to the start of the file name, a hash and the end of the
    # test title (the slug), e.g. "duplicate-detection-and-me-45fa0-plicate-detection-and-merge".
    if (-not $take) {
        $n = [Math]::Min(16, $Slug.Length)
        $head = $Slug.Substring(0, $n)
        $tail = $Slug.Substring($Slug.Length - $n)
        $take = Get-ChildItem (Join-Path $RunDir 'playwright') -Directory |
            Where-Object { $_.Name.StartsWith($head) -and $_.Name.EndsWith($tail) } |
            Get-ChildItem -Filter 'video.webm' | Select-Object -First 1
    }
    if (-not $take) { throw "No video was saved for $Slug" }
    Copy-Item $take.FullName $raw -Force
    $length = Get-Duration $raw
    $offset = Get-VideoOffset $raw ($timeline.steps | Where-Object id -EQ 'opening').start
    Write-Host ("{0}: take {1:N1}s, caption offset {2:N2}s" -f $Slug, $length, $offset)

    $steps = foreach ($step in $timeline.steps) {
        $clip = $manifest.clips | Where-Object id -EQ $step.id
        [pscustomobject]@{
            id = $step.id; chapter = $clip.chapter; text = $clip.text; wav = $clip.wav
            duration = $clip.duration; start = $step.start + $offset; poster = $step.poster
        }
    }

    # Audio: each clip delayed to its caption, mixed, normalized and cut to the video's length.
    $inputs = @(); $filters = @(); $labels = ''
    for ($i = 0; $i -lt $steps.Count; $i++) {
        $inputs += '-i', $steps[$i].wav
        $filters += "[${i}:a]adelay=$([int]($steps[$i].start * 1000)):all=1[a$i]"
        $labels += "[a$i]"
    }
    $filters += "${labels}amix=inputs=$($steps.Count):normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad,atrim=0:$length[out]"
    $voiceTrack = Join-Path $dir 'narration.opus'
    Invoke-Tool ffmpeg (@('-y', '-v', 'error') + $inputs + @('-filter_complex', ($filters -join ';'),
            '-map', '[out]', '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', $voiceTrack)) | Out-Null
    $audio = $voiceTrack
    if ($Music) {
        # The bed loops at a fixed gain well below the voice, fades in over 2 s and out over the last
        # 3 s, and is ducked further while the voice speaks (a sidechain keyed from the narration).
        $culture = [Globalization.CultureInfo]::InvariantCulture
        $len = $length.ToString($culture)
        $fadeOut = [Math]::Max(0, $length - 3).ToString($culture)
        $mix = "[1:a]aresample=48000,aformat=channel_layouts=mono,volume=$($MusicVolume.ToString($culture)),atrim=0:$len,afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3[bed];" +
            "[0:a]asplit=2[voice][key];[bed][key]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400[ducked];" +
            "[voice][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:$len[out]"
        $audio = Join-Path $dir 'mix.opus'
        Invoke-Tool ffmpeg @('-y', '-v', 'error', '-i', $voiceTrack, '-stream_loop', '-1', '-i', (Get-MusicBed),
            '-filter_complex', $mix, '-map', '[out]', '-ac', '1', '-c:a', 'libopus', '-b:a', '64k', $audio) | Out-Null
    }

    # Chapters (FFMETADATA) and WebVTT captions from the same corrected times.
    $meta = @(';FFMETADATA1', "title=FaithTech Community: $($manifest.title)")
    $vtt = @('WEBVTT', '')
    for ($i = 0; $i -lt $steps.Count; $i++) {
        $start = $steps[$i].start
        $end = if ($i + 1 -lt $steps.Count) { $steps[$i + 1].start } else { $length }
        $meta += '[CHAPTER]', 'TIMEBASE=1/1000', "START=$([int]($start * 1000))", "END=$([int]($end * 1000))", "title=$($steps[$i].chapter)"
        $captionEnd = [Math]::Min($end, $start + $steps[$i].duration + $MarginSeconds)
        $vtt += "$(Format-Time $start) --> $(Format-Time $captionEnd)", $steps[$i].text, ''
    }
    $metaFile = Join-Path $dir 'chapters.txt'
    Set-Content -Encoding utf8NoBOM $metaFile ($meta -join "`n")
    $captions = Join-Path $stage 'captions.vtt'
    if ($NoCaptions) { Remove-Item -Force -ErrorAction SilentlyContinue $captions }
    else { Set-Content -Encoding utf8NoBOM $captions ($vtt -join "`n") }

    $video = Join-Path $stage "video.webm"
    Invoke-Tool ffmpeg @('-y', '-v', 'error', '-i', $raw, '-i', $audio, '-f', 'ffmetadata', '-i', $metaFile,
        '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '2', '-map_chapters', '2',
        '-c', 'copy', '-metadata:s:a:0', 'language=eng', $video) | Out-Null

    $poster = $steps | Where-Object poster | Select-Object -First 1
    $posterAt = $poster.start + $poster.duration * 0.8
    Invoke-Tool ffmpeg @('-y', '-v', 'error', '-ss', "$posterAt", '-i', $video, '-frames:v', '1',
        (Join-Path $stage "poster.png")) | Out-Null

    Test-Video $Slug $video $steps $voiceTrack
    $steps | Select-Object id, chapter, start, duration |
        ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $dir 'chapters.json')
}

function Test-Video([string] $Slug, [string] $Video, [object[]] $Steps, [string] $VoiceTrack) {
    $probe = Invoke-Tool ffprobe @('-v', 'error', '-show_streams', '-show_format', '-show_chapters', '-of', 'json', $Video) |
        Out-String | ConvertFrom-Json
    $v = @($probe.streams | Where-Object codec_type -EQ 'video')
    $a = @($probe.streams | Where-Object codec_type -EQ 'audio')
    if ($v.Count -ne 1 -or $v[0].width -ne 1280 -or $v[0].height -ne 720) { throw "${Slug}: expected one 1280x720 video stream" }
    if ($a.Count -ne 1 -or $a[0].codec_name -ne 'opus') { throw "${Slug}: expected one Opus audio stream" }
    if ($probe.chapters.Count -ne $Steps.Count) { throw "${Slug}: expected $($Steps.Count) chapters" }
    # Every paragraph must be audible where its step is shown, in the video and on the narration
    # track alone, so a music bed can never pass for the voice.
    foreach ($step in $Steps) {
        foreach ($source in @($Video, $VoiceTrack) | Select-Object -Unique) {
            $level = & ffmpeg -v info -ss $step.start -t ([Math]::Max(1, $step.duration - 0.3)) -i $source -map 0:a -af volumedetect -f null - 2>&1 |
                Select-String 'mean_volume: (-?[0-9.]+)' | ForEach-Object { [double]$_.Matches[0].Groups[1].Value }
            if ($null -eq $level -or $level -lt -35) { throw "${Slug}: '$($step.id)' is silent (mean $level dB)" }
        }
    }
    $size = (Get-Item $Video).Length / 1MB
    Write-Host ("{0}: verified {1:N1}s, {2}x{3} {4} + opus, {5} chapters, {6:N1} MB" -f $Slug,
        [double]$probe.format.duration, $v[0].width, $v[0].height, $v[0].codec_name, $probe.chapters.Count, $size)
}

# Promote a verified set together, keeping a backup until every file has been copied.
function Publish-Video([string] $Slug) {
    $stage = Join-Path $RunDir $Slug 'stage'
    $backup = Join-Path $RunDir $Slug 'backup'
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    $dest = Join-Path $OutDir $Slug
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $files = Get-ChildItem $stage -File
    # A captionless recording replaces any earlier captions, which would no longer match it.
    if ($NoCaptions) { Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'captions.vtt') }
    foreach ($f in $files) {
        $target = Join-Path $dest $f.Name
        if (Test-Path $target) { Copy-Item $target $backup -Force }
    }
    try {
        foreach ($f in $files) { Copy-Item $f.FullName $dest -Force }
    } catch {
        Get-ChildItem $backup -File | Copy-Item -Destination $dest -Force
        throw
    }
}

Test-Prerequisites
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
foreach ($slug in $Journey) {
    New-Narration $slug
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $RunDir $slug 'timeline.json')
}

# One Playwright run starts the dev server once on its own port and records every journey.
$env:DEMO_RUN_DIR = $RunDir
$env:DEMO_PORT = "$Port"
if ($NoCaptions) { $env:DEMO_NO_CAPTIONS = '1' }
Push-Location (Join-Path $Root 'e2e')
try {
    $env:DEMO_JOURNEYS = $Journey -join ','
    & npx playwright test --config ../eng/videos/playwright.config.ts
    $recorded = $LASTEXITCODE
} finally {
    Pop-Location
    Remove-Item Env:DEMO_RUN_DIR, Env:DEMO_PORT, Env:DEMO_JOURNEYS, Env:DEMO_NO_CAPTIONS -ErrorAction SilentlyContinue
}

$failed = @()
foreach ($slug in $Journey) {
    if (-not (Test-Path (Join-Path $RunDir $slug 'timeline.json'))) { $failed += $slug; continue }
    try {
        Complete-Video $slug
        Publish-Video $slug
    } catch {
        Write-Warning $_
        $failed += $slug
    }
}
if ($recorded -ne 0 -or $failed) {
    throw "Not published: $($failed -join ', '). Earlier videos in docs/videos/journeys were kept."
}
Write-Host "Published $($Journey.Count) video(s) to $OutDir"
