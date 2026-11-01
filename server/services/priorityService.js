export function determinePriority(description) {
  const text = description.toLowerCase();
  const criticalTerms = ['life-threatening', 'life threatening', 'electrocution', 'gas leak', 'collapsed', 'fire'];
  const highTerms = ['urgent', 'danger', 'emergency', 'hazard', 'injury', 'flood', 'exposed wire'];
  if (criticalTerms.some((term) => text.includes(term))) return { level: 'Critical', score: 95 };
  if (highTerms.some((term) => text.includes(term))) return { level: 'High', score: 75 };
  if (text.includes('broken') || text.includes('blocked') || text.includes('leak')) {
    return { level: 'Medium', score: 50 };
  }
  return { level: 'Low', score: 25 };
}
