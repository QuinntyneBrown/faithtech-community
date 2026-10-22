import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { ActivityItemDto, ActivityService } from './activity.service';

@Injectable()
export class HttpActivityService implements ActivityService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/activity`;

  recent(): Observable<ActivityItemDto[]> {
    return this.http.get<ActivityItemDto[]>(this.base);
  }
}
