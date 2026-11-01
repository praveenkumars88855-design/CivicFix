const departmentMap = {
  road: 'Public Works',
  pothole: 'Public Works',
  traffic: 'Traffic Management',
  drainage: 'Water Services',
  drain: 'Water Services',
  garbage: 'Sanitation',
  trash: 'Sanitation',
  streetlight: 'Utilities',
  light: 'Utilities',
  water: 'Water Services',
};

export function getDepartment(description = '') {
  const text = description.toLowerCase();
  const match = Object.entries(departmentMap).find(([keyword]) => text.includes(keyword));
  return match?.[1] || 'General';
}

export default departmentMap;
