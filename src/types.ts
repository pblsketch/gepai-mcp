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
}
