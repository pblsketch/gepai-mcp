/**
 * 배움의 수레바퀴 모형 상수 (이재영 교수의 환경교육 학습 모형)
 * 4단계 + 4연결고리
 *
 * 원본: GEPAI env-edu-platform domain/constants/learning-wheel.ts 에서 이식.
 */

export type LearningStage =
  | '감각과 체험'
  | '성찰과 발견'
  | '창작과 표현'
  | '참여와 실천';

export type ConnectorType = '탐구' | '내면화' | '공유' | '사회화';

export interface StageInfo {
  name: LearningStage;
  nameEn: string;
  description: string;
  examples: string[];
}

export interface ConnectorInfo {
  name: ConnectorType;
  nameEn: string;
  description: string;
  connects: [LearningStage, LearningStage];
  examples: string[];
}

/** 배움의 수레바퀴 4단계 */
export const LEARNING_STAGES: Record<LearningStage, StageInfo> = {
  '감각과 체험': {
    name: '감각과 체험',
    nameEn: 'Sense & Experience',
    description: '오감을 활용하여 환경을 직접 체험하고 느끼는 단계',
    examples: ['자연 관찰 활동', '생태 탐방', '환경 현장 방문', '감각 체험 게임'],
  },
  '성찰과 발견': {
    name: '성찰과 발견',
    nameEn: 'Reflection & Discovery',
    description: '체험한 내용을 성찰하고 의미를 발견하는 단계',
    examples: ['관찰 일지 작성', '토론 및 발표', '원인 분석', '패턴 발견'],
  },
  '창작과 표현': {
    name: '창작과 표현',
    nameEn: 'Creation & Expression',
    description: '깨달은 바를 창의적으로 표현하는 단계',
    examples: ['환경 캠페인 기획', '예술 작품 제작', '시나리오 작성', '모형 제작'],
  },
  '참여와 실천': {
    name: '참여와 실천',
    nameEn: 'Participation & Action',
    description: '실제 환경 문제 해결을 위해 행동하는 단계',
    examples: ['환경 정화 활동', '실천 캠페인', '지역사회 참여', '생활 습관 개선'],
  },
};

/** 배움의 수레바퀴 4연결고리 */
export const CONNECTORS: Record<ConnectorType, ConnectorInfo> = {
  탐구: {
    name: '탐구',
    nameEn: 'Inquiry',
    description: '체험을 바탕으로 질문하고 탐구하는 연결고리',
    connects: ['감각과 체험', '성찰과 발견'],
    examples: ['의문점 제기', '가설 설정', '자료 조사', '실험 설계'],
  },
  내면화: {
    name: '내면화',
    nameEn: 'Internalization',
    description: '발견한 내용을 자신의 가치관으로 내면화하는 연결고리',
    connects: ['성찰과 발견', '창작과 표현'],
    examples: ['가치 탐색', '공감 활동', '자아 성찰', '의미 부여'],
  },
  공유: {
    name: '공유',
    nameEn: 'Sharing',
    description: '자신의 생각과 작품을 타인과 공유하는 연결고리',
    connects: ['창작과 표현', '참여와 실천'],
    examples: ['발표 및 전시', '온라인 공유', '동료 피드백', '협력 학습'],
  },
  사회화: {
    name: '사회화',
    nameEn: 'Socialization',
    description: '실천을 지속하고 사회로 확산하는 연결고리',
    connects: ['참여와 실천', '감각과 체험'],
    examples: ['습관화 전략', '확산 캠페인', '네트워크 형성', '지속가능성 계획'],
  },
};

/** 차시 수에 따른 수레바퀴 블록 추천 */
export function getRecommendedBlocks(totalSessions: number): {
  stages: LearningStage[];
  connectors: ConnectorType[];
  description: string;
} {
  if (totalSessions === 1) {
    return {
      stages: ['감각과 체험', '성찰과 발견'],
      connectors: ['탐구'],
      description: '1차시 수업에는 체험과 성찰을 중심으로 구성합니다.',
    };
  }
  if (totalSessions === 2) {
    return {
      stages: ['감각과 체험', '성찰과 발견', '참여와 실천'],
      connectors: ['탐구', '공유'],
      description: '2차시 수업에는 체험-성찰-실천의 흐름을 만듭니다.',
    };
  }
  if (totalSessions <= 4) {
    return {
      stages: ['감각과 체험', '성찰과 발견', '창작과 표현', '참여와 실천'],
      connectors: ['탐구', '내면화', '공유'],
      description:
        '3-4차시 수업에는 4단계를 모두 포함하되 주요 연결고리를 강조합니다.',
    };
  }
  return {
    stages: ['감각과 체험', '성찰과 발견', '창작과 표현', '참여와 실천'],
    connectors: ['탐구', '내면화', '공유', '사회화'],
    description:
      '장기 수업에는 전체 순환 구조를 활용하여 깊이 있는 학습을 유도합니다.',
  };
}

/** 모형 전체를 마크다운 요약으로 렌더링 (MCP 리소스/프롬프트용) */
export function renderWheelMarkdown(): string {
  const stages = Object.values(LEARNING_STAGES)
    .map(
      (s, i) =>
        `${i + 1}. **${s.name}** (${s.nameEn}): ${s.description}\n   예시 활동: ${s.examples.join(', ')}`
    )
    .join('\n');
  const connectors = Object.values(CONNECTORS)
    .map(
      (c) =>
        `- **${c.name}** (${c.nameEn}): ${c.connects[0]} → ${c.connects[1]}. ${c.description}\n  예시: ${c.examples.join(', ')}`
    )
    .join('\n');
  return `# 배움의 수레바퀴 모형

이재영 교수의 환경교육 학습 모형. 4개의 학습 단계가 수레바퀴처럼 순환하며,
단계 사이를 4개의 연결고리가 잇는다. 수레바퀴는 돌면서 앞으로 나아가고
동심원이 확장되듯 학습의 깊이가 심화된다.

## 4단계 (순환)
${stages}

## 4연결고리
${connectors}

## 차시 수별 권장 구성
- 1차시: 감각과 체험 → [탐구] → 성찰과 발견
- 2차시: 감각과 체험 → [탐구] → 성찰과 발견 → [공유] → 참여와 실천
- 3~4차시: 4단계 전체 + 탐구·내면화·공유 연결고리
- 5차시 이상: 4단계 + 4연결고리 전체 순환 구조로 깊이 있는 학습
`;
}
