import { Pin, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootType } from '../../../../store/store'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '../../../../socket'
import { useNavigate } from 'react-router-dom'
import { setPopUpError } from '../../../../store/slices/popUpSlice'
import { useAccessibleMenu } from '../../../../hooks/useAccessibleMenu'

interface ChatRightClickProps {
	position: { x: number; y: number }
	onClose: () => void
	isGroup?: boolean
	chatId: string
	isAdmin?: boolean
	setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
	isPinned?: boolean
}

export default function ChatRightClick({
	position,
	onClose,
	isGroup,
	isAdmin,
	isPinned,
	setIsLoading,
	chatId,
}: ChatRightClickProps) {
	const menuRef = useRef<HTMLDivElement>(null)
	useAccessibleMenu(menuRef)

	const queryClient = useQueryClient()

	const navigate = useNavigate()

	const dispatch = useDispatch<AppDispatch>()

	const pinChat = () => {
		setIsLoading(true)
		socket.emit(
			'chat:pin-chat',
			{ conversationId: chatId, value: isPinned ? false : true },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					await queryClient.invalidateQueries({
						queryKey: ['chats'],
					})
					setIsLoading(false)
				}
				if (error) {
					console.error('Error updating chat pin:', error)
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to update chat pin. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}

	const deleteChat = () => {
		setIsLoading(true)
		socket.emit(
			'chat:delete-chat',
			{ conversationId: chatId },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					navigate('/chats', { replace: true })

					await queryClient.invalidateQueries({
						queryKey: ['chats'],
					})
					setIsLoading(false)
				}
				if (error) {
					console.error('Error deleting chat:', error)
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to delete chat. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}

	const deleteGroupChat = () => {
		setIsLoading(true)
		socket.emit(
			'group:delete-group-chat',
			{ groupId: chatId },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					navigate('/groups', { replace: true })

					await queryClient.invalidateQueries({
						queryKey: ['groups'],
					})
					setIsLoading(false)
				}
				if (error) {
					console.error('Error deleting group:', error)
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to delete group. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}
	const leaveGroupChat = () => {
		setIsLoading(true)
		socket.emit(
			'group:leave-group-chat',
			{ groupId: chatId },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					navigate('/groups', { replace: true })

					await queryClient.invalidateQueries({
						queryKey: ['groups'],
					})
					setIsLoading(false)
				}
				if (error) {
					console.error('Error leaving group:', error)
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to leave group. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}

	const menuItems = [
		{
			icon: Pin,
			label: isPinned ? 'Unpin' : 'Pin',
			onClick: () => {
				pinChat()
				onClose()
			},
		},
		{
			icon: Trash2,
			label: 'Delete',
			danger: true,
			onClick: () => {
				deleteChat()
				onClose()
			},
		},
	]

	const leaveGroupGroup = {
		icon: Trash2,
		label: 'Leave Group',
		danger: true,
		onClick: () => {
			leaveGroupChat()
			onClose()
		},
	}

	const deleteGroup = {
		icon: Trash2,
		label: 'Delete Group',
		danger: true,
		onClick: () => {
			deleteGroupChat()
			onClose()
		},
	}

	const groupMenuItems = [isAdmin ? deleteGroup : leaveGroupGroup]

	const itemsToRender = isGroup ? groupMenuItems : menuItems

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose()
			}
		}

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		function handleScroll() {
			onClose()
		}

		const timer = setTimeout(() => {
			window.addEventListener('mousedown', handleClickOutside)
			window.addEventListener('pointerdown', handleClickOutside)
			window.addEventListener('contextmenu', handleClickOutside)
			window.addEventListener('keydown', handleKeyDown)
			window.addEventListener('scroll', handleScroll, true)
		}, 0)

		return () => {
			clearTimeout(timer)
			window.removeEventListener('mousedown', handleClickOutside)
			window.removeEventListener('pointerdown', handleClickOutside)
			window.removeEventListener('contextmenu', handleClickOutside)
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('scroll', handleScroll, true)
		}
	}, [onClose])

	const menuWidth = 192
	const menuHeight = 210

	let left = position.x
	let top = position.y

	if (typeof window !== 'undefined') {
		if (left + menuWidth > window.innerWidth) {
			left = Math.max(10, window.innerWidth - menuWidth - 10)
		}
		if (top + menuHeight > window.innerHeight) {
			top = Math.max(10, window.innerHeight - menuHeight - 10)
		}
	}

	const appTheme = useSelector((state: RootType) => state.theme.mode)
	return createPortal(
		<div
			ref={menuRef}
			role='menu'
			aria-label='Chat actions'
			style={{ top: `${top}px`, left: `${left}px` }}
			onContextMenu={e => {
				e.preventDefault()
				e.stopPropagation()
			}}
			className='fixed dark:bg-[#16161B] bg-white w-48 rounded-2xl z-50 border border-white/20 shadow-lg p-1.5 overflow-hidden flex flex-col gap-0.5 dark:text-white select-none'
		>
			{itemsToRender.map((item, index) => {
				const Icon = item.icon
				return (
					<button
						type='button'
						role='menuitem'
						className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-inter transition-colors cursor-pointer text-left w-full ${
							item.danger
								? 'text-red-400 hover:bg-red-500/10'
								: appTheme === 'dark'
									? 'text-[#E0E0E6] hover:bg-white/10'
									: 'text-[#6B6B80] hover:bg-[#ebebf0]/40'
						}`}
						key={index}
						onClick={e => {
							e.stopPropagation()
							item.onClick()
						}}
					>
						<Icon size={16} className='shrink-0' aria-hidden='true' />
						<span>{item.label}</span>
					</button>
				)
			})}
		</div>,
		document.body,
	)
}
