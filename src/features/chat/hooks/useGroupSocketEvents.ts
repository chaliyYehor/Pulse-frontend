import {
	useQueryClient,
	type InfiniteData,
	type QueryKey,
} from '@tanstack/react-query'
import {
	useCallback,
	useEffect,
	useRef,
	type Dispatch,
	type SetStateAction,
} from 'react'
import {
	groupMessageSchema,
	type GroupMessage,
} from '../../../schemas/main/getGroupMessagesResponse'
import type { GroupsResponse } from '../../../schemas/main/getGroupsResponse'
import { socket } from '../../../socket'
import { useNavigate } from 'react-router-dom'
import type { AppDispatch } from '../../../store/store'
import { useDispatch } from 'react-redux'
import { setPopUpError } from '../../../store/slices/popUpSlice'

interface Params {
	groupId: string
	userId?: string
	messageQueryKey: QueryKey
	setMessages: Dispatch<SetStateAction<GroupMessage[]>>
	messageSoundsEnabled: boolean
	playMessageSound: () => void
	setTypingUserId: Dispatch<SetStateAction<string | null>>
}

export function useGroupSocketEvents({
	groupId,
	userId,
	messageQueryKey,
	messageSoundsEnabled,
	playMessageSound,
	setMessages,
	setTypingUserId,
}: Params) {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	)

	const dispatch = useDispatch<AppDispatch>()

	const markAsRead = useCallback(() => {
		socket.emit(
			'group:mark_as_read',
			{ groupId },
			({ success, error }: { success: boolean; error: string | null }) => {
				if (success) {
					queryClient.setQueryData<GroupsResponse>(['groups'], current =>
						current && {
							...current,
							groups: current.groups.map(item =>
								item.group.id === groupId
									? { ...item, groupUser: { ...item.groupUser, unreadMessagesCount: 0 } }
									: item,
							),
						},
					)
					void queryClient.invalidateQueries({ queryKey: ['groups'] })
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
	}, [groupId, dispatch, queryClient])

	useEffect(() => {
		const clearTypingTimer = () => {
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = undefined
		}

		const handleTypingStart = (data: { groupId: string; userId: string }) => {
			if (data.groupId !== groupId || data.userId === userId) return

			setTypingUserId(data.userId)
			clearTypingTimer()
			typingTimerRef.current = setTimeout(() => {
				setTypingUserId(current => (current === data.userId ? null : current))
				typingTimerRef.current = undefined
			}, 5000)
		}

		const handleTypingStop = (data: { groupId: string; userId: string }) => {
			if (data.groupId !== groupId || data.userId === userId) return
			clearTypingTimer()
			setTypingUserId(current => (current === data.userId ? null : current))
		}

		const handleMessageReceived = (data: { groupId: string }) => {
			if (data.groupId !== groupId) return
			void queryClient.invalidateQueries({
				queryKey: ['groups'],
			})
		}

		const handleNewGroupMessages = (data: unknown) => {
			if (!Array.isArray(data)) return

			const parsedMessages = data.flatMap(item => {
				const parsed = groupMessageSchema.safeParse(item)
				return parsed.success && parsed.data.groupId === groupId
					? [parsed.data]
					: []
			})
			if (parsedMessages.length === 0) return

			setMessages(current => {
				const existingIds = new Set(current.map(message => message.id))
				const newMessages = parsedMessages.filter(
					message => !existingIds.has(message.id),
				)
				return newMessages.length > 0
					? [...newMessages, ...current].sort(
							(first, second) =>
								second.createdAt.getTime() - first.createdAt.getTime(),
						)
					: current
			})

			queryClient.setQueryData<
				InfiniteData<{ messages: GroupMessage[]; hasMore: boolean }, number>
			>(messageQueryKey, current => {
				const firstPage = current?.pages[0]
				if (!current || !firstPage) return current

				const existingIds = new Set(
					current.pages.flatMap(page =>
						page.messages.map(message => message.id),
					),
				)
				const newMessages = parsedMessages.filter(
					message => !existingIds.has(message.id),
				)
				if (newMessages.length === 0) return current

				return {
					...current,
					pages: [
						{
							...firstPage,
							messages: [...newMessages, ...firstPage.messages].sort(
								(first, second) =>
									second.createdAt.getTime() - first.createdAt.getTime(),
							),
						},
						...current.pages.slice(1),
					],
				}
			})
		}

		const handleDeletedMessage = (data: {
			groupId: string
			messageId: string
		}) => {
			if (data.groupId !== groupId) return

			setMessages(current =>
				current.filter(message => message.id !== data.messageId),
			)

			queryClient.setQueryData<
				InfiniteData<{ messages: GroupMessage[]; hasMore: boolean }, number>
			>(
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

		const handleGroupChatCleared = (data: { groupId: string }) => {
			if (data.groupId !== groupId) return
			setMessages([])
			void queryClient.invalidateQueries({ queryKey: ['messages', groupId] })
			void queryClient.invalidateQueries({ queryKey: ['groups'] })
		}

		const handleGroupDescriptionUpdated = (data: {
			groupId: string
			description: string
		}) => {
			if (data.groupId !== groupId) return
			void queryClient.invalidateQueries({ queryKey: ['groups'] })
		}

		const handleGroupDeleted = (data: { groupId: string }) => {
			if (data.groupId === groupId) {
				queryClient.invalidateQueries({ queryKey: ['groups'] })
				navigate('/groups', { replace: true })
			}
		}

		const handleGroupLeft = (data: { groupId: string }) => {
			if (data.groupId === groupId) {
				queryClient.invalidateQueries({ queryKey: ['groups'] })
				navigate('/groups', { replace: true })
			}
		}

		const handleNotificationReceived = (data: { groupId: string }) => {
			if (data.groupId !== groupId) return
			if (messageSoundsEnabled) {
				playMessageSound()
			}
		}

		socket.on('group:deleted', handleGroupDeleted)
		socket.on('group:typing:start', handleTypingStart)
		socket.on('group:typing:stop', handleTypingStop)
		socket.on('notification:new_group_message', handleNotificationReceived)
		socket.on('group:left', handleGroupLeft)
		socket.on('group:message:received', handleMessageReceived)
		socket.on('message:new_group_messages', handleNewGroupMessages)
		socket.on('message:deleted_group', handleDeletedMessage)
		socket.on('group:chat:cleared', handleGroupChatCleared)
		socket.on('group:description:updated', handleGroupDescriptionUpdated)
		return () => {
			socket.off('group:deleted', handleGroupDeleted)
			socket.off('group:typing:start', handleTypingStart)
			socket.off('group:typing:stop', handleTypingStop)
			socket.off('group:message:received', handleMessageReceived)
			socket.off('notification:new_group_message', handleNotificationReceived)
			socket.off('message:new_group_messages', handleNewGroupMessages)
			socket.off('group:left', handleGroupLeft)
			socket.off('message:deleted_group', handleDeletedMessage)
			socket.off('group:description:updated', handleGroupDescriptionUpdated)
			socket.off('group:chat:cleared', handleGroupChatCleared)
			clearTypingTimer()
			setTypingUserId(null)
		}
	}, [
		groupId,
		userId,
		queryClient,
		messageQueryKey,
		setMessages,
		setTypingUserId,
		navigate,
		messageSoundsEnabled,
		playMessageSound,
	])
	return { markAsRead }
}
