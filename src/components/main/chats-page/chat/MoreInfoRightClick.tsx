import { Pin, Search, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import type { AppDispatch, RootType } from '../../../../store/store'
import { useDispatch, useSelector } from 'react-redux'
import { socket } from '../../../../socket'
import { useQueryClient } from '@tanstack/react-query'
import {
	setPopUpError,
	setPopUpLoading,
	setPopUpSuccess,
} from '../../../../store/slices/popUpSlice'
import { closePopUpLoading } from '../../../../lib/openPopUps'
import { useAccessibleMenu } from '../../../../hooks/useAccessibleMenu'
import AreYouSure from '../AreYouSure'

interface MoreInfoRightClickProps {
	isAdmin?: boolean
	position: { x: number; y: number }
	onClose: () => void
	isGroup?: boolean
	chatId: string
	isPinned: boolean
	messagesLength?: number
	onSearchClick: (value: SetStateAction<boolean>) => void
}

interface MenuItem {
	icon: LucideIcon
	label: string
	onClick: () => void
	danger?: boolean
	isDisabled?: boolean
	isAdmin?: boolean
}

export default function MoreInfoRightClick({
	position,
	onClose,
	isGroup = false,
	isPinned,
	isAdmin,
	messagesLength,
	chatId,
	onSearchClick,
}: MoreInfoRightClickProps) {
	const menuRef = useRef<HTMLDivElement>(null)
	useAccessibleMenu(menuRef)

	const queryClient = useQueryClient()

	const [loading, setIsLoading] = useState(false)
	const [isClearing, setIsClearing] = useState(false)

	const pinChat = () => {
		setIsLoading(true)
		socket.emit(
			'chat:pin-chat',
			{ conversationId: chatId, value: isPinned ? false : true },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					await Promise.all([
						queryClient.invalidateQueries({
							queryKey: ['chats'],
						}),
						queryClient.invalidateQueries({
							queryKey: ['chatInfo', chatId],
						}),
					])
					setIsLoading(false)
				}
				if (error) {
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to pin/unpin the chat. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}

	const dispatch = useDispatch<AppDispatch>()

	const clearChat = () => {
		if (messagesLength === 0) {
			return
		}

		setIsLoading(true)
		dispatch(
			setPopUpLoading({ heading: 'Clearing chat', text: 'Please wait...' }),
		)
		socket.emit(
			'chat:clear-chat',
			{ conversationId: chatId },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					await Promise.all([
						queryClient.invalidateQueries({
							queryKey: ['chats'],
						}),
						queryClient.invalidateQueries({
							queryKey: ['chatInfo', chatId],
						}),
					])
					setIsLoading(false)
					closePopUpLoading()
					dispatch(setPopUpLoading({ heading: '', text: '' }))
					dispatch(
						setPopUpSuccess({
							heading: 'Chat cleared',
							text: 'The chat has been cleared successfully.',
						}),
					)
				} else {
					console.error('Error clearing chat:', error)
					dispatch(setPopUpLoading({ heading: '', text: '' }))
					closePopUpLoading()
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to clear the chat. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}
	const clearGroupChat = () => {
		if (messagesLength === 0) {
			return
		}

		if (!isAdmin || !isGroup) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'You are not the admin of this group or it is not a group.',
				}),
			)
			return
		}

		setIsLoading(true)
		dispatch(
			setPopUpLoading({
				heading: 'Clearing group chat',
				text: 'Please wait...',
			}),
		)
		socket.emit(
			'group:clear-group-chat',
			{ groupId: chatId },
			async ({ success, error }: { success: boolean; error?: string }) => {
				if (success) {
					await Promise.all([
						queryClient.invalidateQueries({
							queryKey: ['groups'],
						}),
					])
					setIsLoading(false)
					closePopUpLoading()
					dispatch(setPopUpLoading({ heading: '', text: '' }))
					dispatch(
						setPopUpSuccess({
							heading: 'Group chat cleared',
							text: 'The group chat has been cleared successfully.',
						}),
					)
				} else {
					console.error('Error clearing group chat:', error)
					dispatch(setPopUpLoading({ heading: '', text: '' }))
					closePopUpLoading()
					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to clear the group chat. Please try again.',
						}),
					)
					setIsLoading(false)
				}
			},
		)
	}

	const menuItems: MenuItem[] = [
		{
			icon: Search,
			label: 'Search in chat',
			onClick: () => {
				onSearchClick(true)
				onClose()
			},
		},
		{
			icon: Pin,
			label: isPinned ? 'Unpin chat' : 'Pin chat',
			isDisabled: loading,
			onClick: () => {
				pinChat()
				onClose()
			},
		},
		{
			icon: Trash2,
			label: 'Clear chat',
			danger: true,
			onClick: () => {
				setIsClearing(true)
			},
		},
	]

	const clearChatGroup = {
		isAdmin: isAdmin ?? false,
		icon: Trash2,
		label: 'Clear group chat',
		danger: true,
		onClick: () => {
			setIsClearing(true)
		},
	}
	const searchInChatGroup = {
		icon: Search,
		label: 'Search in chat',
		onClick: () => {
			onSearchClick(true)
			onClose()
		},
	}

	const groupMenuItems: MenuItem[] = isAdmin
		? [searchInChatGroup, clearChatGroup]
		: [searchInChatGroup]

	const menuItemsToRender = isGroup ? groupMenuItems : menuItems
	useEffect(() => {
		if (isClearing) return

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
			window.addEventListener('contextmenu', handleClickOutside)
			window.addEventListener('keydown', handleKeyDown)
			window.addEventListener('scroll', handleScroll, true)
		}, 0)

		return () => {
			clearTimeout(timer)
			window.removeEventListener('mousedown', handleClickOutside)
			window.removeEventListener('contextmenu', handleClickOutside)
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('scroll', handleScroll, true)
		}
	}, [isClearing, onClose])

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
			aria-label='More conversation options'
			style={{ top: `${top}px`, left: `${left}px` }}
			onContextMenu={e => {
				e.preventDefault()
				e.stopPropagation()
			}}
			className='fixed dark:bg-[#16161B] bg-white text-black dark:text-white w-48 rounded-2xl z-50 border border-white/20 shadow-2xl p-1.5 overflow-hidden flex flex-col gap-0.5 select-none'
		>
			{isClearing && (
				<AreYouSure
					isGroupChat={isGroup}
					onCancel={() => {
						setIsClearing(false)
						onClose()
					}}
					onConfirm={() => {
						setIsClearing(false)
						onClose()
						if (isGroup) clearGroupChat()
						else clearChat()
					}}
				/>
			)}
			{menuItemsToRender.map((item, index) => {
				const Icon = item.icon
				return (
					<button
						disabled={item.isDisabled}
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
						<span>
							{item.label}
							{loading && item.label === 'Pin chat' && ' ...'}
						</span>
					</button>
				)
			})}
		</div>,
		document.body,
	)
}
