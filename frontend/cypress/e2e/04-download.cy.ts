// Scénarios 15-19 : téléchargement (US02 + US09)

const uniqueEmail = () => `test-${Date.now()}@datashare.test`

function uploadFileViaApi(win: Window, jwtToken: string, options: { password?: string } = {}): Promise<string> {
  const formData = new (win as any).FormData()
  const blob = new (win as any).Blob(['e2e test file content'], { type: 'text/plain' })
  formData.append('file', blob, 'testfile.txt')
  formData.append('expires_in_days', '7')
  if (options.password) formData.append('password', options.password)
  return (win as any).fetch('/api/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwtToken}` },
    body: formData,
  }).then((res: Response) => res.json()).then((data: any) => data.token as string)
}

describe('US02 + US09 — Téléchargement', () => {
  let jwtToken: string

  before(() => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.apiLogin(email, 'motdepasse123').then(t => { jwtToken = t })
  })

  it('15. page de téléchargement affiche nom, taille et date d\'expiration', () => {
    cy.visit('/')
    cy.window().then(win => uploadFileViaApi(win, jwtToken)).then(token => {
      cy.visit(`/download/${token}`)
      cy.get('[data-testid=file-name]').should('contain', 'testfile.txt')
      cy.get('[data-testid=file-size]').should('be.visible')
      cy.get('[data-testid=file-expiry]').should('be.visible')
    })
  })

  it('16. fichier non protégé → bouton Télécharger actif', () => {
    cy.visit('/')
    cy.window().then(win => uploadFileViaApi(win, jwtToken)).then(token => {
      cy.visit(`/download/${token}`)
      cy.get('[data-testid=download-button]').should('not.be.disabled')
      cy.get('[data-testid=password-input]').should('not.exist')
    })
  })

  it('17. fichier protégé par mot de passe → champ mot de passe affiché', () => {
    cy.visit('/')
    cy.window().then(win => uploadFileViaApi(win, jwtToken, { password: 'secret123' })).then(token => {
      cy.visit(`/download/${token}`)
      cy.get('[data-testid=password-input]').should('be.visible')
      cy.contains('Ce fichier est protégé par un mot de passe').should('be.visible')
      cy.get('[data-testid=download-button]').should('be.disabled')
    })
  })

  it('18. mot de passe correct → téléchargement déclenché (pas d\'erreur)', () => {
    cy.visit('/')
    cy.window().then(win => uploadFileViaApi(win, jwtToken, { password: 'secret123' })).then(token => {
      cy.visit(`/download/${token}`)
      cy.get('[data-testid=password-input]').type('secret123')
      cy.get('[data-testid=download-button]').should('not.be.disabled').click()
      cy.get('[data-testid=wrong-password]').should('not.exist')
    })
  })

  it('19. mot de passe incorrect → message d\'erreur affiché', () => {
    cy.visit('/')
    cy.window().then(win => uploadFileViaApi(win, jwtToken, { password: 'secret123' })).then(token => {
      cy.visit(`/download/${token}`)
      cy.get('[data-testid=password-input]').type('mauvaismdp')
      cy.get('[data-testid=download-button]').click()
      cy.get('[data-testid=wrong-password]', { timeout: 8000 }).should('be.visible').and('contain', 'Mot de passe incorrect')
    })
  })

  it('20. lien invalide → page d\'erreur "Lien invalide"', () => {
    cy.visit('/download/token-inexistant-xyz')
    cy.get('[data-testid=not-found]').should('be.visible').and('contain', 'Lien invalide')
  })
})
