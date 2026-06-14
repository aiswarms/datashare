// Scénarios 21-26 : historique, tags, suppression (US05, US06, US08)

const uniqueEmail = () => `test-${Date.now()}@datashare.test`

function uploadViaApi(win: Window, token: string, options: { tags?: string[]; expired?: boolean } = {}): Promise<void> {
  const formData = new (win as any).FormData()
  const blob = new (win as any).Blob(['history test content'], { type: 'text/plain' })
  formData.append('file', blob, 'history-file.txt')
  formData.append('expires_in_days', options.expired ? '1' : '7')
  if (options.tags) options.tags.forEach(tag => formData.append('tags[]', tag))
  return (win as any).fetch('/api/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
}

describe('US05 / US06 / US08 — Historique, suppression et tags', () => {
  let jwtToken: string

  beforeEach(() => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.apiLogin(email, 'motdepasse123').then(t => { jwtToken = t })
  })

  it('21. historique liste les fichiers uploadés', () => {
    cy.visit('/')
    cy.window().then(win => uploadViaApi(win, jwtToken))
    cy.visit('/my-space')
    cy.get('[data-testid=file-row]', { timeout: 8000 }).should('have.length.at.least', 1)
    cy.contains('history-file.txt').should('be.visible')
  })

  it('22. filtre par tag → seuls les fichiers correspondants affichés', () => {
    cy.visit('/')
    cy.window().then(win => uploadViaApi(win, jwtToken, { tags: ['rapport'] }))
    cy.window().then(win => uploadViaApi(win, jwtToken, { tags: ['photo'] }))
    cy.visit('/my-space')
    cy.get('[data-testid=file-row]', { timeout: 8000 }).should('have.length.at.least', 2)
    cy.get('[data-testid=tag-chip-rapport]').click()
    cy.get('[data-testid=file-row]').should('have.length', 1)
    cy.get('[data-testid=clear-tag-filter]').click()
    cy.get('[data-testid=file-row]').should('have.length.at.least', 2)
  })

  it('23. suppression → dialogue de confirmation puis fichier retiré de la liste', () => {
    cy.visit('/')
    cy.window().then(win => uploadViaApi(win, jwtToken))
    cy.visit('/my-space')
    cy.get('[data-testid=file-row]', { timeout: 8000 }).should('have.length.at.least', 1)
    cy.get('[data-testid=delete-button]').first().click()
    cy.contains('Confirmer la suppression ?').should('be.visible')
    cy.get('[data-testid=confirm-delete-button]').click()
    cy.get('[data-testid=file-row]', { timeout: 8000 }).should('have.length', 0)
    cy.get('[data-testid=empty]').should('contain', 'Aucun fichier')
  })

  it('24. annulation de suppression → fichier reste dans la liste', () => {
    cy.visit('/')
    cy.window().then(win => uploadViaApi(win, jwtToken))
    cy.visit('/my-space')
    cy.get('[data-testid=file-row]', { timeout: 8000 }).should('have.length.at.least', 1)
    cy.get('[data-testid=delete-button]').first().click()
    cy.contains('Confirmer la suppression ?').should('be.visible')
    cy.get('[data-testid=cancel-delete-button]').click()
    cy.get('[data-testid=file-row]').should('have.length.at.least', 1)
  })

  it('25. liste vide → message "Aucun fichier" affiché', () => {
    cy.apiLogin
    cy.visit('/my-space')
    cy.get('[data-testid=empty]', { timeout: 8000 }).should('contain', 'Aucun fichier')
  })

  it('26. onglet "Actifs" ne montre que les fichiers non expirés', () => {
    cy.visit('/')
    cy.window().then(win => uploadViaApi(win, jwtToken))
    cy.visit('/my-space')
    cy.get('[data-testid=tab-active]').click()
    cy.get('[data-testid=file-row]', { timeout: 8000 }).each($row => {
      cy.wrap($row).should('not.contain', 'Expiré')
    })
  })
})
