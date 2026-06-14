// Scénarios 12-13 : upload anonyme (US07)

describe('US07 — Upload anonyme', () => {
  it('12. upload anonyme → succès avec lien de téléchargement', () => {
    cy.visit('/')
    cy.contains('Partager un fichier')

    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from('contenu anonyme'), fileName: 'anon.txt', mimeType: 'text/plain' },
      { force: true }
    )
    cy.contains('anon.txt').should('be.visible')
    cy.contains('Téléverser').click()
    cy.contains('Copier le lien', { timeout: 10000 }).should('be.visible')
    cy.contains('/download/').should('be.visible')
  })

  it('13. upload anonyme avec mot de passe → succès', () => {
    cy.visit('/')
    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from('fichier protégé anonyme'), fileName: 'protected-anon.txt', mimeType: 'text/plain' },
      { force: true }
    )
    cy.get('input[type=password]').type('secret123')
    cy.contains('Téléverser').click()
    cy.contains('Copier le lien', { timeout: 10000 }).should('be.visible')
  })

  it('14. utilisateur authentifié → redirigé vers /upload (pas la page anonyme)', () => {
    const email = `test-${Date.now()}@datashare.test`
    cy.apiRegister(email, 'motdepasse123')
    cy.apiLogin(email, 'motdepasse123')
    cy.visit('/')
    cy.url().should('include', '/upload')
    cy.contains('Ajouter un fichier')
  })
})
