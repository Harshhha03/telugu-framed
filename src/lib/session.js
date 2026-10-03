const KEY = 'telugu-framed-session-id'

// A player never needs an account: this random id (kept in localStorage)
// is enough for the backend to remember today's attempts if they refresh.
export function getSessionId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
