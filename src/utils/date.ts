export function formatDateBR(date: string | null) {
  if (!date) return ''

  return new Date(date)
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-')
}