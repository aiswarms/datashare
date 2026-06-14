// Scénarios 7-11 : upload authentifié

const uniqueEmail = () => `test-${Date.now()}@datashare.test`

describe('US01 — Upload authentifié', () => {
  let userEmail: string
  let jwtToken: string

  beforeEach(() => {
    userEmail = uniqueEmail()
    cy.apiRegister(userEmail, 'motdepasse123')
    cy.apiLogin(userEmail, 'motdepasse123').then(token => { jwtToken = token })
  })

  it('7. upload fichier simple → lien de téléchargement affiché', () => {
    cy.visit('/upload')
    cy.contains('Ajouter un fichier')

    const file = new File(['contenu de test'], 'rapport.pdf', { type: 'application/pdf' })
    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from('contenu de test'), fileName: 'rapport.pdf', mimeType: 'application/pdf' },
      { force: true }
    )
    cy.contains('rapport.pdf').should('be.visible')
    cy.contains('Téléverser').click()
    cy.contains('Copier le lien', { timeout: 10000 }).should('be.visible')
    cy.contains('/download/').should('be.visible')
  })

  it('8. upload avec mot de passe → succès confirmé', () => {
    cy.visit('/upload')
    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from('fichier protégé'), fileName: 'secret.txt', mimeType: 'text/plain' },
      { force: true }
    )
    cy.get('input[type=password]').type('monsecret')
    cy.contains('Téléverser').click()
    cy.contains('Copier le lien', { timeout: 10000 }).should('be.visible')
  })

  it('9. upload avec tags → tags visibles dans l\'historique', () => {
    cy.window().then(win => {
      const formData = new win.FormData()
      const blob = new win.Blob(['tagged file content'], { type: 'text/plain' })
      formData.append('file', blob, 'tagged.txt')
      formData.append('expires_in_days', '7')
      formData.append('tags[]', 'cypress')
      formData.append('tags[]', 'e2e')
      return win.fetch('/api/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: formData,
      })
    })
    cy.visit('/my-space')
    cy.contains('cypress').should('be.visible')
    cy.contains('e2e').should('be.visible')
  })

  it('10. upload avec expiration 1 jour → confirmation affichée', () => {
    cy.visit('/upload')
    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from('expiration test'), fileName: 'temp.txt', mimeType: 'text/plain' },
      { force: true }
    )
    cy.get('select').select('1')
    cy.contains('Téléverser').click()
    cy.contains('une journée', { timeout: 10000 }).should('be.visible')
  })

  it('11. upload type interdit (.exe) → erreur serveur affichée', () => {
    cy.window().then(win => {
      const formData = new win.FormData()
      const blob = new win.Blob(['MZ malware'], { type: 'application/octet-stream' })
      formData.append('file', blob, 'malware.exe')
      formData.append('expires_in_days', '7')
      return win.fetch('/api/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: formData,
      }).then(res => {
        expect(res.status).to.eq(422)
        return res.json()
      })
    }).then(body => {
      expect(body.error).to.eq('FORBIDDEN_FILE_TYPE')
    })
  })
})
