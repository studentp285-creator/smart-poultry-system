import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyAWZCpJGqGNXW2CbKAcLIunHyqsYbBYeg0',
  authDomain:        'smart-poultry-bf401.firebaseapp.com',
  databaseURL:       'https://smart-poultry-bf401-default-rtdb.firebaseio.com',
  projectId:         'smart-poultry-bf401',
  storageBucket:     'smart-poultry-bf401.firebasestorage.app',
  messagingSenderId: '1085337660805',
  appId:             '1:1085337660805:web:6fd9125b158539785aa8ec',
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export const auth = getAuth(app)
