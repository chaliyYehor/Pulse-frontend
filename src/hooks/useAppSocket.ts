import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../store/store'
import { socket } from '../socket'
import {
	setGlobalSocketError,
	setIsSocketConnected,
} from '../store/slices/socketSlice'
import type { ChatResponse, ChatsResponse } from '../schemas/main/getChatsResponse'

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

		const handleChatAdded = (chat: ChatResponse) => {
			queryClient.setQueryData<ChatsResponse>(['chats'], current => {
				if (!current) return current
				if (current.some(item => item.conversation.id === chat.conversation.id)) return current
				return [...current, chat].sort(
					(a, b) => b.conversation.updatedAt.getTime() - a.conversation.updatedAt.getTime(),
				)
			})
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const handleChatDeleted = (data: { conversationId: string }) => {
			queryClient.setQueryData<ChatsResponse>(['chats'], current =>
				current?.filter(chat => chat.conversation.id !== data.conversationId),
			)
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const updateChatPreview = (data: {
			conversationId: string
			lastMessage: string | null
			lastMessageAt: Date | string | null
		}) => {
			const lastMessageAt = data.lastMessageAt
				? new Date(data.lastMessageAt)
				: null
			queryClient.setQueryData<ChatsResponse>(['chats'], current =>
				current
					?.map(chat =>
						chat.conversation.id === data.conversationId
							? {
									...chat,
									conversation: {
										...chat.conversation,
										lastMessage: data.lastMessage,
										lastMessageAt,
										updatedAt: lastMessageAt ?? new Date(),
									},
								}
							: chat,
					)
					.sort(
						(a, b) =>
							b.conversation.updatedAt.getTime() -
							a.conversation.updatedAt.getTime(),
					),
			)
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
		socket.on('chat:added', handleChatAdded)
		socket.on('chat:deleted', handleChatDeleted)
		socket.on('message:received', updateChatPreview)
		socket.on('message:deleted', updateChatPreview)
		socket.on('chat:cleared', invalidateChats)
		socket.on('presence:changed', handlePresenceChanged)
		socket.on('call:history:updated', invalidatePreviousCalls)

		socket.connect()

		return () => {
			socket.off('connect', handleConnect)
			socket.off('disconnect', handleDisconnect)
			socket.off('connect_error', handleConnectError)
			socket.off('chat:added', handleChatAdded)
			socket.off('chat:deleted', handleChatDeleted)
			socket.off('message:received', updateChatPreview)
			socket.off('message:deleted', updateChatPreview)
			socket.off('chat:cleared', invalidateChats)
			socket.off('presence:changed', handlePresenceChanged)
			socket.off('call:history:updated', invalidatePreviousCalls)
			socket.disconnect()
		}
	}, [dispatch, enabled, queryClient])
}
