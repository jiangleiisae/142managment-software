import { apiClient } from './client'

export type MeetingMethod = 'ONSITE' | 'ONLINE' | 'HYBRID'
export type TaskCategory = 'DAILY' | 'MAJOR' | 'QTG' | 'OTHER'

export interface Meeting {
  id: string
  subject: string
  startAt: string
  endAt: string
  method: MeetingMethod
  department: string | null
  location: string | null
  hostPersonnelId: string | null
  recorderPersonnelId: string | null
  attendeeIds: string[]
  host: string | null
  recorder: string | null
  attendees: string[]
  topics: string | null
  lastWeekReport: string | null
  thisWeekTasksJson: { category: TaskCategory; content: string }[]
  faultAnalysis: string | null
  suggestions: string | null
}

export interface MeetingInput {
  organizationId: string
  subject: string
  startAt: string
  endAt: string
  method?: MeetingMethod
  department?: string
  location?: string
  hostPersonnelId?: string
  recorderPersonnelId?: string
  attendeeIds?: string[]
  topics?: string
  lastWeekReport?: string
  thisWeekTasks?: { category: TaskCategory; content: string }[]
  faultAnalysis?: string
  suggestions?: string
}

export interface Training {
  id: string
  subject: string
  startAt: string
  endAt: string
  location: string | null
  trainerName: string | null
  content: string | null
  attendeeIds: string[]
  attendees: string[]
}

export interface TrainingInput {
  organizationId: string
  subject: string
  startAt: string
  endAt: string
  location?: string
  trainerName?: string
  content?: string
  attendeeIds?: string[]
}

export interface InspectionItem {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export interface InspectionRecord {
  id: string
  inspectedOn: string
  title: string
  performedBy: string | null
  overallResult: 'pass' | 'issues_found'
  notes: string | null
  items: { name: string; passed: boolean; notes: string | null }[]
}

export type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED'
export type QuestionType = 'SINGLE' | 'MULTI' | 'RATING' | 'TEXT'

export interface SurveyQuestion {
  id: string
  type: QuestionType
  text: string
  required: boolean
  options?: string[]
}

export interface SurveyQuestionInput {
  type: QuestionType
  text: string
  required?: boolean
  options?: string[]
}

export interface Survey {
  id: string
  title: string
  description: string | null
  anonymous: boolean
  status: SurveyStatus
  questions: SurveyQuestion[]
  responseCount: number
}

export interface SurveyStats {
  id: string
  title: string
  status: SurveyStatus
  anonymous: boolean
  totalResponses: number
  stats: {
    id: string
    type: QuestionType
    text: string
    answered: number
    options?: { option: string; count: number; percent: number }[]
    average?: number | null
    distribution?: { score: number; count: number }[]
    texts?: string[]
  }[]
  records: { respondent: string | null; submittedAt: string }[]
}

export interface MySurvey {
  id: string
  title: string
  description: string | null
  anonymous: boolean
  organizationName: string
  answered: boolean
  questions: SurveyQuestion[]
}

export const qualityApi = {
  listMeetings: (organizationId: string, params: { from?: string; to?: string; keyword?: string } = {}) => apiClient.get<Meeting[]>('/quality/meetings', { params: { organizationId, ...params } }).then((r) => r.data),
  createMeeting: (data: MeetingInput) => apiClient.post('/quality/meetings', data).then((r) => r.data),
  updateMeeting: (id: string, data: Partial<Omit<MeetingInput, 'organizationId'>>) => apiClient.patch(`/quality/meetings/${id}`, data).then((r) => r.data),
  deleteMeeting: (id: string) => apiClient.delete(`/quality/meetings/${id}`).then((r) => r.data),

  listTrainings: (organizationId: string, params: { from?: string; to?: string; keyword?: string } = {}) => apiClient.get<Training[]>('/quality/trainings', { params: { organizationId, ...params } }).then((r) => r.data),
  createTraining: (data: TrainingInput) => apiClient.post('/quality/trainings', data).then((r) => r.data),
  updateTraining: (id: string, data: Partial<Omit<TrainingInput, 'organizationId'>>) => apiClient.patch(`/quality/trainings/${id}`, data).then((r) => r.data),
  deleteTraining: (id: string) => apiClient.delete(`/quality/trainings/${id}`).then((r) => r.data),

  listInspectionItems: (organizationId: string) => apiClient.get<InspectionItem[]>('/quality/inspection-items', { params: { organizationId } }).then((r) => r.data),
  setInspectionItems: (organizationId: string, names: string[]) => apiClient.put<InspectionItem[]>('/quality/inspection-items', { organizationId, names }).then((r) => r.data),
  listInspections: (organizationId: string, params: { from?: string; to?: string; result?: string } = {}) => apiClient.get<InspectionRecord[]>('/quality/inspections', { params: { organizationId, ...params } }).then((r) => r.data),
  createInspection: (data: { organizationId: string; inspectedOn: string; title: string; performedByPersonnelId?: string; results: { name: string; passed: boolean; notes?: string }[]; notes?: string }) =>
    apiClient.post('/quality/inspections', data).then((r) => r.data),

  listSurveys: (organizationId: string) => apiClient.get<Survey[]>('/quality/surveys', { params: { organizationId } }).then((r) => r.data),
  createSurvey: (data: { organizationId: string; title: string; description?: string; anonymous?: boolean; questions: SurveyQuestionInput[] }) => apiClient.post('/quality/surveys', data).then((r) => r.data),
  updateSurvey: (id: string, data: { title?: string; description?: string; anonymous?: boolean; questions?: SurveyQuestionInput[] }) => apiClient.patch(`/quality/surveys/${id}`, data).then((r) => r.data),
  deleteSurvey: (id: string) => apiClient.delete(`/quality/surveys/${id}`).then((r) => r.data),
  publishSurvey: (id: string) => apiClient.post(`/quality/surveys/${id}/publish`).then((r) => r.data),
  closeSurvey: (id: string) => apiClient.post(`/quality/surveys/${id}/close`).then((r) => r.data),
  surveyStats: (id: string) => apiClient.get<SurveyStats>(`/quality/surveys/${id}/stats`).then((r) => r.data),

  mySurveys: () => apiClient.get<MySurvey[]>('/quality/my-surveys').then((r) => r.data),
  respond: (id: string, answers: Record<string, unknown>) => apiClient.post(`/quality/surveys/${id}/respond`, { answers }).then((r) => r.data),
}
