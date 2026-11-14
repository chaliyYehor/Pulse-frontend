import {
	useCallback,
	useEffect,
	useRef,
	type Dispatch,
	type SetStateAction,
} from 'react'
import {
	useQueryClient,
	type InfiniteData,
	type QueryKey,
} from '@tanstack/react-query'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { socket } from '../../../socket'
import type { Message, Messages } from '../../../schemas/main/messages'
import type { ChatsResponse } from '../../../schemas/main/getChatsResponse'
import type { AppDispatch } from '../../../store/store'
import { setPopUpError } from '../../../store/slices/popUpSlice'

interface Params {
	chatId: string
	userId?: string
	messageQueryKey: QueryKey
	messageSoundsEnabled: boolean
	setMessages: Dispatch<SetStateAction<Message[]>>
	setIsUserTyping: Dispatch<SetStateAction<boolean>>
	playMessageSound: () => void
}

export function useChatSocketEvents({
	chatId,
	userId,
	messageQueryKey,
	messageSoundsEnabled, 
	setMessages,
	setIsUserTyping,
	playMessageSound,
}: Params) {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const dispatch = useDispatch<AppDispatch>()
	const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	)

	const markAsRead = useCallback(() => {
		socket.emit(
			'message:mark_as_read',
			{ chatId },
			({ success, error }: { success: boolean; error: string | null }) => {
				if (success) {
					queryClient.setQueryData<ChatsResponse>(['chats'], current =>
						current?.map(chat =>
							chat.conversation.id === chatId
								? {
										...chat,
										conversationUser: {
											...chat.conversationUser,
											unreadMessagesCount: 0,
										},
									}
								: chat,
						),
					)
					setMessages(current =>
						current.map(message =>
							message.senderId !== userId ? { ...message, read: true } : message,
						),
					)
					queryClient.setQueryData<InfiniteData<Messages, number>>(
						messageQueryKey,
						current =>
							current && {
								...current,
								pages: current.pages.map(page => ({
									...page,
									messages: page.messages.map(message =>
										message.senderId !== userId
											? { ...message, read: true }
											: message,
									),
								})),
							},
					)
					void queryClient.invalidateQueries({ queryKey: ['chats'] })
					void queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
				}
				if (error) {
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to mark messages as read. Please try again.',
						}),
					)
					console.error('Error marking messages as read:', error)
				}
			},
		)
	}, [chatId, dispatch, messageQueryKey, queryClient, setMessages, userId])

	useEffect(() => {
		const handleNewMessages = (data: Messages['messages']) => {
			const chatMessages = data
				.filter(message => message.conversationId === chatId)
				.map(message => ({
					...message,
					createdAt: new Date(message.createdAt),
				}))

			setMessages(current => {
				const newMessages = chatMessages.filter(
					message => !current.some(existing => existing.id === message.id),
				)
				return newMessages.length > 0 ? [...newMessages, ...current] : current
			})

			queryClient.setQueryData<InfiniteData<Messages, number>>(
				messageQueryKey,
				current => {
					const firstPage = current?.pages[0]
					if (!current || !firstPage) return current

					const existingIds = new Set(
						firstPage.messages.map(message => message.id),
					)
					const newMessages = chatMessages.filter(
						message => !existingIds.has(message.id),
					)
					if (newMessages.length === 0) return current

					return {
						...current,
						pages: [
							{
								...firstPage,
								messages: [...newMessages, ...firstPage.messages],
							},
							...current.pages.slice(1),
						],
					}
				},
			)
		}

		const handleMessageReceived = (data: { conversationId: string }) => {
			if (data.conversationId !== chatId) return

			void queryClient.invalidateQueries({ queryKey: ['chats'] })
			void queryClient.invalidateQueries({ queryKey: ['userInfoChat', chatId] })
			void queryClient.invalidateQueries({
				queryKey: ['sharedMedia', { chatId }],
			})
		}

		const handleNotificationReceived = (data: { conversationId: string }) => {
			if (data.conversationId !== chatId) return

			if (messageSoundsEnabled) playMessageSound()
		}

		const handleMessagesRead = (data: { conversationId: string }) => {
			if (data.conversationId === chatId) {
				setMessages(current =>
					current.map(message =>
						message.senderId === userId ? { ...message, read: true } : message,
					),
				)
				queryClient.setQueryData<InfiniteData<Messages, number>>(
					messageQueryKey,
					current =>
						current && {
							...current,
							pages: current.pages.map(page => ({
								...page,
								messages: page.messages.map(message =>
									message.senderId === userId
										? { ...message, read: true }
										: message,
								),
							})),
						},
				)
				void queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
			}
		}

		const handleChatCleared = (data: { conversationId: string }) => {
			if (data.conversationId !== chatId) return
			setMessages([])
			void queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const handleChatDeleted = (data: { conversationId: string }) => {
			if (data.conversationId === chatId) navigate('/chats', { replace: true })
		}

		const handlePresenceChanged = () => {
			void queryClient.invalidateQueries({ queryKey: ['userInfoChat', chatId] })
			void queryClient.invalidateQueries({ queryKey: ['chats'] })
		}

		const handleTypingStart = (data: { chatId: string; userId: string }) => {
			if (data.chatId !== chatId || data.userId === userId) return

			setIsUserTyping(true)
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = setTimeout(() => {
				setIsUserTyping(false)
				typingTimerRef.current = undefined
			}, 5000)
		}

		const handleTypingStop = (data: { chatId: string; userId: string }) => {
			if (data.chatId !== chatId || data.userId === userId) return
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = undefined
			setIsUserTyping(false)
		}

		const handleDeletedMessage = (data: {
			conversationId: string
			messageId: string
		}) => {
			if (data.conversationId !== chatId) return

			setMessages(current =>
				current.filter(message => message.id !== data.messageId),
			)
			queryClient.setQueryData<InfiniteData<Messages, number>>(
				messageQueryKey,
				current =>
					current && {
						...current,
						pages: current.pages.map(page => ({
							...page,
							messages: page.messages.filter(
								message => message.id !== data.messageId,
							),
						})),
					},
			)
		}

		void queryClient.invalidateQueries({ queryKey: ['chats'] })
		void queryClient.invalidateQueries({ queryKey: ['userInfoChat', chatId] })
		socket.on('notification:new_message', handleNotificationReceived)
		socket.on('typing:start', handleTypingStart)
		socket.on('typing:stop', handleTypingStop)
		socket.on('message:read',  handleMessagesRead)
		socket.on('message:new_messages', handleNewMessages)
		socket.on('message:received', handleMessageReceived)
		socket.on('message:deleted', handleDeletedMessage)
		socket.on('chat:deleted', handleChatDeleted)
		socket.on('chat:cleared', handleChatCleared)
		socket.on('presence:changed', handlePresenceChanged)

		return () => {
			socket.off('typing:start', handleTypingStart)
			socket.off('notification:new_message', handleNotificationReceived)
			socket.off('typing:stop', handleTypingStop)
			socket.off('message:read', handleMessagesRead)
			socket.off('message:new_messages', handleNewMessages)
			socket.off('message:received', handleMessageReceived)
			socket.off('message:deleted', handleDeletedMessage)
			socket.off('chat:deleted', handleChatDeleted)
			socket.off('chat:cleared', handleChatCleared)
			socket.off('presence:changed', handlePresenceChanged)
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = undefined
		}
	}, [
		chatId,
		messageQueryKey,
		messageSoundsEnabled,
		navigate,
		playMessageSound,
		queryClient,
		setIsUserTyping,
		setMessages,
		userId,
	])

	return { markAsRead }
}
