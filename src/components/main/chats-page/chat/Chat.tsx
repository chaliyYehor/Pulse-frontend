import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import Avatar from '../../Avatar'
import CallButon from './CallButton'
import Message from './Message'
import MoreInfoButton from './MoreInfoButton'
import SendAMessage from './SendAMessage'
import VideoCallBtn from './VideoCallBtn'
import UserInfo from '../../UserInfo'
import ImageMessage from './ImageMessage'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootType } from '../../../../store/store'
import { getDisplayedStatus } from '../../../../lib/getDisplayedStatus'
import { useGetUserInfoChat } from '../../../../hooks/useGetUserInfoChat'
import { useGetChatInfo } from '../../../../hooks/useGetChatInfo'
import clsx from 'clsx'
import { useGetMessages } from '../../../../hooks/useGetMessages'
import { authClient } from '../../../../lib/auth-client'
import type { Message as MessageData } from '../../../../schemas/main/messages'
import ScrollDownBtn from '../../../ScrollDownBtn'
import SearchInChat from './SearchInChat'
import { formatLastSeen } from '../../../../lib/formatLastSeen'
import IsTyping from './IsTyping'
import { setPopUpError } from '../../../../store/slices/popUpSlice'
import { useGetUserPreferences } from '../../../../hooks/useGetUserPreferences'
import { useMessageSound } from '../../../../hooks/useMessageSound'
import { useChatSocketEvents } from '../../../../features/chat/hooks/useChatSocketEvents'

export function Chat() {
	const [isProfileOpened, setIsProfileOpened] = useState(false)
	const [isSearchOpened, setIsSearchOpened] = useState(false)

	const [hasScrolled, setHasScrolled] = useState(false)

	const [isTyping, setIsTyping] = useState(false)
	const [isUserTyping, setIsUserTyping] = useState(false)

	const chatref = useRef<HTMLDivElement>(null)
	const pendingScrollAdjustmentRef = useRef<{
		scrollHeight: number
		scrollTop: number
	} | null>(null)
	const skipAutoScrollRef = useRef(false)
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		setHasScrolled(e.currentTarget.scrollTop < -400)
	}, [])

	useEffect(() => {
		if (isUserTyping && !hasScrolled) {
			chatref.current?.scrollTo({ top: 0, behavior: 'smooth' })
		}
	}, [isUserTyping, hasScrolled])

	const latestMessageRef = useRef<HTMLDivElement>(null)
	const [messagesState, setMessagesState] = useState<MessageData[]>([])
	const [oldestMessageElement, setOldestMessageElement] =
		useState<HTMLDivElement | null>(null)
	const [newestMessageElement, setNewestMessageElement] =
		useState<HTMLDivElement | null>(null)

	const appTheme = useSelector((state: RootType) => state.theme.mode)

	const dispatch = useDispatch<AppDispatch>()

	const chatId = useParams().chatId
	const userId = authClient.useSession().data?.user?.id

	const {
		data: userInfo,
		isError: isUserInfoError,
		isPending: isUserInfoPending,
	} = useGetUserInfoChat(chatId as string)
	const {
		data: chatInfo,
		isError: isChatInfoError,
		isPending: isChatInfoPending,
	} = useGetChatInfo(chatId as string)

	const {
		data: messages,
		isError: isMessagesError,
		isPending: isMessagesPending,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useGetMessages({
		conversationId: chatId as string,
		limit: 40,
	})

	useEffect(() => {
		if (isMessagesError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load messages. Please try again.',
				}),
			)
		}
		if (isUserInfoError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load user information. Please try again.',
				}),
			)
		}
		if (isChatInfoError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load chat information. Please try again.',
				}),
			)
		}
	}, [isMessagesError, isUserInfoError, isChatInfoError])

	const messageQueryKey = useMemo(
		() => ['messages', chatId, 'infinite'] as const,
		[chatId],
	) 
	const { data: preferences, isError: isPreferencesError } =
		useGetUserPreferences()
	const playMessageSound = useMessageSound()
	const { markAsRead } = useChatSocketEvents({
		chatId: chatId as string,
		userId,
		messageQueryKey,
		messageSoundsEnabled: preferences?.messageSounds ?? false,
		setMessages: setMessagesState,
		setIsUserTyping,
		playMessageSound,
	})

	const loadOlderMessages = useCallback(() => {
		const container = chatref.current
		if (!container || !hasNextPage || isFetchingNextPage) return

		pendingScrollAdjustmentRef.current = {
			scrollHeight: container.scrollHeight,
			scrollTop: container.scrollTop,
		}
		skipAutoScrollRef.current = true
		void fetchNextPage().then(result => {
			if (result.isFetchNextPageError) {
				pendingScrollAdjustmentRef.current = null
				skipAutoScrollRef.current = false
			}
		})
	}, [fetchNextPage, hasNextPage, isFetchingNextPage])

	const setLatestMessageRefs = useCallback((node: HTMLDivElement | null) => {
		latestMessageRef.current = node
		setNewestMessageElement(node)
	}, [])

	useEffect(() => {
		if (!newestMessageElement) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					markAsRead()
				}
			},
			{ threshold: 0.5 },
		)

		observer.observe(newestMessageElement)

		return () => observer.disconnect()
	}, [markAsRead, newestMessageElement])

	useEffect(() => {
		if (!oldestMessageElement || !hasNextPage) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					loadOlderMessages()
				}
			},
			{ threshold: 0.5 },
		)

		observer.observe(oldestMessageElement)

		return () => observer.disconnect()
	}, [oldestMessageElement, hasNextPage, loadOlderMessages])

	useEffect(() => {
		setMessagesState([])
		pendingScrollAdjustmentRef.current = null
		skipAutoScrollRef.current = false
	}, [chatId])

	useEffect(() => {
		if (messages && !isMessagesPending) {
			setMessagesState(currentMessages => {
				const fetchedMessages = messages.pages.flatMap(page => page.messages)
				const messageMap = new Map<string, MessageData>()
				for (const message of [...currentMessages, ...fetchedMessages]) {
					messageMap.set(message.id, message)
				}
				return [...messageMap.values()].sort(
					(first, second) =>
						second.createdAt.getTime() - first.createdAt.getTime(),
				)
			})
		}
	}, [messages, isMessagesPending])

	useLayoutEffect(() => {
		const container = chatref.current
		const previousPosition = pendingScrollAdjustmentRef.current
		if (!container || !previousPosition) return

		container.scrollTop =
			previousPosition.scrollTop -
			(container.scrollHeight - previousPosition.scrollHeight)
		pendingScrollAdjustmentRef.current = null
	}, [messagesState])

	const scrollToLatestMessage = () => {
		latestMessageRef.current?.scrollIntoView({
			behavior: 'smooth',
			block: 'end',
		})
	}

	useEffect(() => {
		if (skipAutoScrollRef.current) {
			skipAutoScrollRef.current = false
			return
		}
		if (!isMessagesPending && messagesState.length > 0 && !hasScrolled) {
			chatref.current?.scrollTo({ top: 0, behavior: 'instant' })
		}

	}, [messagesState, isMessagesPending])

	useEffect(() => {
		if (isPreferencesError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to fetch user preferences. Please try again.',
				}),
			)
		}
	}, [isPreferencesError, dispatch])

	const socketError = useSelector((state: RootType) => state.socketState.globalSocketError)

	const navigate = useNavigate()

	useEffect(() => {
		if(socketError) {
			navigate('/chats', { replace: true })
		}
	}, [socketError])

	return (
		<div className='w-full h-full overflow-hidden flex flex-col dark:bg-[#16161b] bg-white border-l border-gray-700/60'>
			<div className='relative p-4 pl-0 shrink-0 flex w-full justify-between items-center border-b border-gray-700/60'>
				<div className='flex justify-center items-center gap-3'>
					{isProfileOpened && (
						<UserInfo
							sharedMedia={true}
							isYourProfile={false}
							userInfo={userInfo}
							isFetching={isUserInfoPending}
							chatId={chatId as string}
							setIsProfileOpened={setIsProfileOpened}
						/>
					)}
					<Link
						to='/chats'
						aria-label='Back to chats'
						className={`cursor-pointer transition-all duration-200 ease-in-out rounded-full ml-4 ${appTheme === 'dark' ? 'hover:bg-[#2D2D3B]' : 'hover:bg-[#E5E5EA]'}`}
					>
						<ArrowLeft color='#6B6B80' />
					</Link>
					<button
						type='button'
						onClick={() => setIsProfileOpened(true)}
						className='cursor-pointer hover:outline-2 hover:outline-[#7C5CFC] transition-all duration-200 ease-in-out rounded-full'
						aria-label='Open profile'
					>
						<Avatar
							imageUrl={userInfo?.imageUrl || undefined}
							isLoading={isUserInfoPending}
							state={getDisplayedStatus(
								userInfo?.status,
								userInfo?.previouslySetStatus,
							)}
						/>
					</button>
					<div className='flex min-w-0 flex-1 flex-col gap-1'>
						<p
							className={clsx(
								isUserInfoPending ? 'skeleton-shimmer' : '',
								'font-semibold font-inter text-md truncate dark:text-white h-6 flex min-w-30 rounded-md',
							)}
						>
							<span translate='no'>{userInfo?.name || ''}</span>
						</p>
						<p
							className={clsx(
								isUserInfoPending ? 'skeleton-shimmer' : '',
								'text-[#6B6B80] text-[13px] font-inter text-xs h-4 min-w-10 rounded-md capitalize',
							)}
						>
							{userInfo &&
								userInfo.lastSeen &&
								userInfo.status === 'offline' &&
								'Last seen: '}
							{!isUserInfoPending &&
								(userInfo?.status === 'offline' && userInfo.lastSeen
									? formatLastSeen(userInfo.lastSeen)
									: getDisplayedStatus(
											userInfo?.status,
											userInfo?.previouslySetStatus,
										))}
						</p>
					</div>
				</div>
				<div className='h-full shrink-0 flex justify-center items-center gap-1 md:gap-2'>
					{isChatInfoPending ? (
						<div className='w-full h-full flex justify-center items-center'>
							<div className='loader' role='status' aria-label='Loading chat information' />
						</div>
					) : (
						<>
							<CallButon chatId={chatId as string} size={16} />
							<VideoCallBtn chatId={chatId as string} size={16} />
							<MoreInfoButton
								messagesLength={messagesState.length}
								onSearchClick={() => setIsSearchOpened(true)}
								isPinned={chatInfo?.conversationUserData.isPinned!}
								chatId={chatId as string}
							/>
						</>
					)}
				</div>
				{isSearchOpened && (
					<SearchInChat onClose={() => setIsSearchOpened(false)} />
				)}
			</div>

			<div
				ref={chatref}
				onScroll={handleScroll}
				role='log'
				aria-label='Chat messages'
				aria-live='polite'
				aria-relevant='additions'
				className='messages relative w-full min-h-0 flex-1 flex flex-col-reverse text-white p-5 pb-0 gap-2'
			>
				{
					<ScrollDownBtn
						isVisible={hasScrolled}
						onClick={scrollToLatestMessage}
					/>
				}
				{isMessagesPending || isUserInfoPending ? (
					<div className='w-full h-full flex justify-center items-center'>
						<div className='loader' role='status' aria-label='Loading messages' />
					</div>
				) : !userInfo ? (
					<div className='w-full h-full flex justify-center items-center'>
						<p>Failed to load user information</p>
					</div>
				) : (
					<>
						<IsTyping userInfo={userInfo} isTyping={isUserTyping} />
						{messagesState.map((message, index) => (
							<div
								key={message.id}
								ref={
									index === 0
										? setLatestMessageRefs
										: index === messagesState.length - 1
											? setOldestMessageElement
											: null
								}
							>
								{message.type === 'image' ? (
									<ImageMessage
										isFetching={isUserInfoPending}
										isSeen={message.read}
										messageInfo={message}
										userInfo={userInfo}
										isMe={message.senderId === userId}
										chatId={chatId as string}
									/>
								) : (
									<Message
										imageUrl={userInfo?.imageUrl ?? undefined}
										messageInfo={message}
										isFetching={isUserInfoPending}
										userInfo={userInfo}
										isMe={message.senderId === userId}
										chatId={chatId as string}
									/>
								)}
							</div>
						))}
						{!hasNextPage && messagesState.length > 10 && (
							<div className='w-full flex items-center justify-center gap-2 py-2 px-1'>
								<div className='w-full h-px bg-[#6B6B80]/15' />
								<p className='text-center text-[#6B6B80] font-mono uppercase tracking-wider font-light text-sm text-nowrap'>
									No more messages
								</p>
								<div className='w-full h-px bg-[#6B6B80]/15' />
							</div>
						)}
						{hasNextPage && isFetchingNextPage && (
							<div className='w-full flex justify-center items-center py-2'>
								<div className='loader bg-white dark:bg-black' role='status' aria-label='Loading older messages' />
							</div>
						)}
					</>
				)}
			</div>

			<SendAMessage
				isTyping={isTyping}
				setIsTyping={setIsTyping}
				lastMessageAt={messagesState[0]?.createdAt}
				chatId={chatId as string}
			/>
		</div>
	)
}
