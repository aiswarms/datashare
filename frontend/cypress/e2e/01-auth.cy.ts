// Scénarios 1-6 : inscription, connexion, déconnexion

const uniqueEmail = () => `test-${Date.now()}@datashare.test`

describe('US03 — Inscription', () => {
  it('1. inscription valide → redirige vers /login', () => {
    cy.visit('/register')
    cy.contains('Créer un compte')
    cy.get('input[type=email]').type(uniqueEmail())
    cy.get('input[type=password]').first().type('motdepasse123')
    cy.get('input[type=password]').last().type('motdepasse123')
    cy.get('button[type=submit]').click()
    cy.url().should('include', '/login')
  })

  it('2. inscription avec email déjà utilisé → message d\'erreur', () => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.visit('/register')
    cy.get('input[type=email]').type(email)
    cy.get('input[type=password]').first().type('motdepasse123')
    cy.get('input[type=password]').last().type('motdepasse123')
    cy.get('button[type=submit]').click()
    cy.contains('Email already registered').should('be.visible')
  })

  it('3. mots de passe non identiques → erreur de validation', () => {
    cy.visit('/register')
    cy.get('input[type=email]').type(uniqueEmail())
    cy.get('input[type=password]').first().type('motdepasse123')
    cy.get('input[type=password]').last().type('autremotdepasse')
    cy.get('button[type=submit]').click()
    cy.contains('Les mots de passe ne correspondent pas').should('be.visible')
  })
})

describe('US04 — Connexion', () => {
  it('4. connexion valide → redirige vers /upload', () => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.visit('/login')
    cy.contains('Connexion')
    cy.get('input[type=email]').type(email)
    cy.get('input[type=password]').type('motdepasse123')
    cy.get('button[type=submit]').click()
    cy.url().should('include', '/upload')
  })

  it('5. mot de passe incorrect → message d\'erreur affiché', () => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.visit('/login')
    cy.get('input[type=email]').type(email)
    cy.get('input[type=password]').type('mauvaismdp')
    cy.get('button[type=submit]').click()
    cy.get('p[style*="color"]').should('be.visible')
  })

  it('6. déconnexion → retour accueil, lien Se connecter visible', () => {
    const email = uniqueEmail()
    cy.apiRegister(email, 'motdepasse123')
    cy.apiLogin(email, 'motdepasse123')
    cy.visit('/my-space')
    cy.get('[data-testid=logout-button]').click()
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
    cy.contains('Se connecter').should('be.visible')
    cy.window().its('localStorage').invoke('getItem', 'token').should('be.null')
  })
})
