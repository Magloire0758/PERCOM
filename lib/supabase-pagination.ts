export interface LectureError {
  message: string
  details?: string
  hint?: string
  code?: string
}

interface PageResult<T> {
  data: T[] | null
  error: LectureError | null
}

export async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<PageResult<T>> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1)
    if (error) return { data: null, error }

    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}
