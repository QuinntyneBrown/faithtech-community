import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { HubSectionKind } from './event-hubs.service';
import {
  HubTemplateDefaultInput,
  HubTemplateDetailDto,
  HubTemplateSummaryDto,
  HubTemplatesService,
} from './hub-templates.service';

@Injectable()
export class HttpHubTemplatesService implements HubTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  /** The pages and dialogs show their own failed states with Try again. */
  private readonly own = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);

  list(archived: boolean): Observable<HubTemplateSummaryDto[]> {
    return this.http.get<HubTemplateSummaryDto[]>(`${this.api}/hub-templates`, {
      params: { archived },
      context: this.own,
    });
  }

  get(id: string): Observable<HubTemplateDetailDto> {
    return this.http.get<HubTemplateDetailDto>(`${this.api}/hub-templates/${id}`, {
      context: this.own,
    });
  }

  add(name: string, description: string | null): Observable<HubTemplateSummaryDto> {
    return this.http.post<HubTemplateSummaryDto>(
      `${this.api}/hub-templates`,
      { name, description },
      { context: this.own },
    );
  }

  rename(id: string, name: string, description: string | null): Observable<HubTemplateSummaryDto> {
    return this.http.put<HubTemplateSummaryDto>(
      `${this.api}/hub-templates/${id}`,
      { name, description },
      { context: this.own },
    );
  }

  setSections(id: string, shown: HubSectionKind[]): Observable<HubTemplateDetailDto> {
    return this.http.put<HubTemplateDetailDto>(
      `${this.api}/hub-templates/${id}/sections`,
      { shown },
      { context: this.own },
    );
  }

  saveDefault<K extends HubSectionKind>(
    id: string,
    kind: K,
    content: HubTemplateDefaultInput<K>,
  ): Observable<void> {
    return this.http.put<void>(`${this.api}/hub-templates/${id}/sections/${kind}`, content, {
      context: this.own,
    });
  }

  archive(id: string): Observable<HubTemplateSummaryDto> {
    return this.http.post<HubTemplateSummaryDto>(`${this.api}/hub-templates/${id}/archive`, null, {
      context: this.own,
    });
  }

  restore(id: string): Observable<HubTemplateSummaryDto> {
    return this.http.post<HubTemplateSummaryDto>(`${this.api}/hub-templates/${id}/restore`, null, {
      context: this.own,
    });
  }
}
