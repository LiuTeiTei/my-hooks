export const parseValue = (value: string, defaultValue: any): any => {
  try {
    if (typeof defaultValue === 'number') return Number(value)
    if (typeof defaultValue === 'boolean') return Boolean(value)
    if (typeof defaultValue === 'object') return JSON.parse(value)
    return value
  } catch {
    return defaultValue
  }
}

export const stringifyValue = (value: any): string =>
  typeof value === 'object' ? JSON.stringify(value) : String(value)
