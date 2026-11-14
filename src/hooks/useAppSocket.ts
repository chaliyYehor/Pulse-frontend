import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../store/store'
import { socket } from '../socket'
import {
	setGlobalSocketError,
	setIsSocketConnected,
} from '../store/slices/socketSlice'

export function useAppSocket(enabled: boolean) {
	const dispatch = useDispatch<AppDispatch>()
	const queryClient = useQueryClient()

	useEffect(() => {
		if (!enabled) return

		const handleConnect = () => {
			dispatch(setIsSocketConnected(true))
			dispatch(setGlobalSocketError(null))

			void queryClient.invalidateQueries({ queryKey: ['userInfo'] })
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const handleConnectError = (error: Error) => {
			dispatch(setIsSocketConnected(false))

			if (error.message === 'Too Many Requests') {
				dispatch(setGlobalSocketError('Too many requests'))
			} else if (error.message === 'Forbidden') {
				dispatch(setGlobalSocketError('Connection forbidden'))
			} else {
				dispatch(setGlobalSocketError('Unable to connect to server'))
			}
		}

		const handleDisconnect = () => {
			dispatch(setIsSocketConnected(false))
			dispatch(setGlobalSocketError(null))
		}

		const invalidateChats = () => {
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const invalidatePreviousCalls = () => {
			void queryClient.invalidateQueries({ queryKey: ['previousCalls'] })
		}

		const handlePresenceChanged = () => {
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		socket.on('connect', handleConnect)
		socket.on('disconnect', handleDisconnect)
		socket.on('connect_error', handleConnectError)
		socket.on('chat:added', invalidateChats)
		socket.on('chat:deleted', invalidateChats)
		socket.on('message:received', invalidateChats)
		socket.on('message:deleted', invalidateChats)
		socket.on('chat:cleared', invalidateChats)
		socket.on('presence:changed', handlePresenceChanged)
		socket.on('call:history:updated', invalidatePreviousCalls)

		socket.connect()

		return () => {
			socket.off('connect', handleConnect)
			socket.off('disconnect', handleDisconnect)
			socket.off('connect_error', handleConnectError)
			socket.off('chat:added', invalidateChats)
			socket.off('chat:deleted', invalidateChats)
			socket.off('message:received', invalidateChats)
			socket.off('message:deleted', invalidateChats)
			socket.off('chat:cleared', invalidateChats)
			socket.off('presence:changed', handlePresenceChanged)
			socket.off('call:history:updated', invalidatePreviousCalls)
			socket.disconnect()
		}
	}, [dispatch, enabled, queryClient])
}
