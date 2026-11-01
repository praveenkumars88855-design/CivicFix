import { getDepartment } from '../utils/departmentMap.js';
import { determinePriority } from './priorityService.js';

const categoryTerms = {
  Road: ['pothole', 'road', 'pavement', 'sidewalk', 'traffic sign'],
  Streetlight: ['streetlight', 'street light', 'lamp', 'light pole'],
  Garbage: ['garbage', 'trash', 'waste', 'dump', 'litter'],
  Water: ['water', 'leak', 'pipe', 'flood'],
  Drainage: ['drain', 'sewer', 'manhole', 'drainage'],
  Traffic: ['traffic', 'signal', 'crosswalk'],
};

export function suggestIssueDetails(title, description, chosenCategory) {
  const text = `${title} ${description}`.toLowerCase();
  const detectedCategory = Object.entries(categoryTerms)
    .flatMap(([category, terms]) => terms
      .map((term) => ({ category, position: text.indexOf(term) }))
      .filter(({ position }) => position >= 0))
    .sort((first, second) => first.position - second.position)[0]?.category;
  const category = chosenCategory || detectedCategory || 'Other';
  const priority = determinePriority(text);

  return {
    category,
    department: getDepartment(`${category} ${text}`),
    severity: priority.level === 'Critical' ? 5 : priority.level === 'High' ? 4 : priority.level === 'Medium' ? 2 : 1,
    priorityScore: priority.score,
    priorityLevel: priority.level,
    aiReason: `Suggested ${category} classification and ${priority.level.toLowerCase()} priority from report keywords.`,
  };
}
