'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const supabase = createClient()

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '10px'
    }}>
      <h1>Login — ConstructERP</h1>

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          padding: '10px',
          margin: '5px 0',
          borderRadius: '5px',
          border: '1px solid #ccc',
          width: '300px'
        }}
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          padding: '10px',
          margin: '5px 0',
          borderRadius: '5px',
          border: '1px solid #ccc',
          width: '300px'
        }}
      />

      <button 
        onClick={handleLogin}
        style={{
          padding: '10px 20px',
          margin: '10px 0',
          backgroundColor: '#1e2640',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          width: '300px'
        }}
      >
        Iniciar sesión
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}