declare global {
  namespace Cypress {
    interface Chainable {
      apiRegister(email: string, password: string): Chainable<void>
      apiLogin(email: string, password: string): Chainable<string>
      apiUpload(token: string, options?: { password?: string; tags?: string[]; expiresInDays?: number }): Chainable<string>
    }
  }
}

Cypress.Commands.add('apiRegister', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/register',
    body: { email, password },
    failOnStatusCode: false,
  })
})

Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  }).then((response) => {
    const token = response.body.token as string
    window.localStorage.setItem('token', token)
    return token
  })
})

Cypress.Commands.add('apiUpload', (token: string, options: { password?: string; tags?: string[]; expiresInDays?: number } = {}) => {
  const formData = new FormData()
  const blob = new Blob(['test file content for e2e'], { type: 'text/plain' })
  formData.append('file', blob, 'testfile.txt')
  if (options.password) formData.append('password', options.password)
  if (options.tags) options.tags.forEach(tag => formData.append('tags[]', tag))
  if (options.expiresInDays) formData.append('expires_in_days', String(options.expiresInDays))

  cy.request({
    method: 'POST',
    url: '/api/files',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    encoding: 'binary',
    failOnStatusCode: false,
  }).then((response) => {
    return response.body.token as string
  })
})

export {}
