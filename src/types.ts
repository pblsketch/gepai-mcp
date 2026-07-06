/** 2022 개정 교육과정 성취기준 */
export interface Standard {
  /** 성취기준 코드 (괄호 제거): "6과05-03" */
  code: string;
  /** 학교급: 초등학교 | 중학교 | 고등학교 */
  school: string;
  /** 과목 */
  subject: string;
  /** 학년(학년군): "1~2학년" 등 */
  grade: string;
  /** 성취기준 내용 */
  content: string;
}

/** 자료가 참조하는 성취기준 */
export interface StandardRef {
  code: string;
  text: string;
}

/** 원문 문서 (실서비스 RAG에서 AI 강화된 PDF 단위 카탈로그) */
export interface Doc {
  id: number;
  uuid: string;
  fileName: string;
  filePath: string;
  /** 시도교육청/지역 (정규화됨, "전국" 포함) */
  region: string;
  schoolLevel: string;
  grade?: string;
  subjects: string[];
  envTopics: string[];
  sdgs: string[];
  competencies: string[];
  methods: string[];
  resourceType: string;
  activityType: string;
  location: string;
  /** AI 생성 시맨틱 키워드 */
  keywords: string[];
  standards: StandardRef[];
  /** 원문 PDF의 GCS 경로 (공개 URL 아님) */
  gcsUri: string;
  /** 연결된 정선 카탈로그 자료 id */
  resourceIds: number[];
  /** 자료집 원본 페이지 URL (연결된 정선 카탈로그에서 전파) */
  link?: string;
}

/** 교육부 자원맵 환경교육 자료 */
export interface Resource {
  id: number;
  /** 시도교육청 */
  office: string;
  /** 자료집 이름 */
  collection: string;
  /** 개별 활동/자료 제목 */
  title: string;
  /** 자료유형 */
  materialType: string;
  /** 활동 유형 */
  activityTypes: string[];
  /** 학교급 원문: "초등학교(5~6)" */
  schoolLevelRaw: string;
  /** 표준화된 학교급 목록 */
  schoolLevels: string[];
  /** 시간(차시) */
  hours: string;
  /** 과목명 */
  subjects: string[];
  /** 환경교육역량 */
  competencies: string[];
  /** 장소 */
  place: string;
  /** 환경주제 */
  envTopics: string[];
  /** SDGs 목표 */
  sdgs: string[];
  /** 교수학습방법 */
  methods: string[];
  /** 연계 성취기준 */
  standards: StandardRef[];
  /** 자료집 원본 페이지 URL (교육청 자료실/환경교육포털 등, 자료집 단위) */
  link?: string;
}
