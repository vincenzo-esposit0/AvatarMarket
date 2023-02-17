# AvatarMarket

Progetto realizzato per l'esame di Sicurezza dei Dati.<br>
Partendo dal tutorial di [Pet Shop tutorial](http://truffleframework.com/tutorial), ho sviluppato un market di avatar.

## Installazione

1. Installa Truffle.
    ```javascript
    npm install -g truffle
    ```

2. Installa [Ganache](https://trufflesuite.com/ganache/) e configura una nuova blockchain di test.

3. Effettua il download del repository e apri la cartella su VisualStudio Code.

5. Esegui la console di sviluppo.
    ```javascript
    truffle develop
    ```

4. Compila e migra fgli smart contracts.
    ```javascript
    compile
    migrate
    ```

5. Esegui il server di sviluppo `liteserver` (all'esterno della console di sviluppo). Le modifiche allo smart contract devono essere ricompilate e migrate manualmente.
    ```javascript
    // Serves the front-end on http://localhost:3000
    npm run dev
    ```

**NOTE**: 
