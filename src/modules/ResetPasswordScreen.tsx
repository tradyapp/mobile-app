/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState } from 'react'
import { Block, Button, List, ListInput, BlockTitle } from 'konsta/react'
import { authService } from '@/services/AuthService'

interface ResetPasswordScreenProps {
  onDone: () => void
}

const ResetPasswordScreen = ({ onDone }: ResetPasswordScreenProps) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      await authService.updatePassword(password)
      setMessage('Contraseña actualizada correctamente.')
      onDone()
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Block className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Nueva contraseña</h1>
          <p className="text-zinc-400">Ingresa y confirma tu nueva contraseña.</p>
        </Block>

        <form onSubmit={handleSubmit}>
          <BlockTitle className="text-white">Actualizar contraseña</BlockTitle>
          <List strong inset>
            <ListInput
              label="Nueva contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <ListInput
              label="Confirmar contraseña"
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </List>

          {error && (
            <Block className="text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </Block>
          )}
          {message && (
            <Block className="text-center">
              <p className="text-emerald-400 text-sm">{message}</p>
            </Block>
          )}

          <Block>
            <Button
              type="submit"
              large
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Guardar nueva contraseña'}
            </Button>
          </Block>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordScreen
