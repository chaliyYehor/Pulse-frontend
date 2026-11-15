import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import CallButon from '../chat/CallButton'
// import ImageMessage from '../chat/ImageMessage'
// import MoreInfoButton from '../chat/MoreInfoButton'
// import SendAMessage from '../chat/SendAMessage'
import VideoCallBtn from '../chat/VideoCallBtn'
import GroupInfo from './GroupInfo'
import GroupPfp from './GroupPfp'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGetGroups } from '../../../../hooks/useGetGroups'
import type { AppDispatch, RootType } from '../../../../store/store'
import { useDispatch, useSelector } from 'react-redux'
import { setPopUpError } from '../../../../store/slices/popUpSlice'
import type { GroupResponse } from '../../../../schemas/main/getGroupsResponse'
import MoreInfoButton from '../chat/MoreInfoButton'
import SendAMessage from '../chat/SendAMessage'
import SearchInChat from '../chat/SearchInChat'
import { ArrowLeft } from 'lucide-react'
import { useGetGroupMessages } from '../../../../hooks/useGetGroupMessages'
import { useGroupSocketEvents } from '../../../../features/chat/hooks/useGroupSocketEvents'
import type { GroupMessage } from '../../../../schemas/main/getGroupMessagesResponse'
import ScrollDownBtn from '../../../ScrollDownBtn'
import ImageMessage from '../chat/ImageMessage'
import Message from '../chat/Message'
import { authClient } from '../../../../lib/auth-client'
import { useMessageSound } from '../../../../hooks/useMessageSound'
import { useGetUserPreferences } from '../../../../hooks/useGetUserPreferences'
import IsTyping from '../chat/IsTyping'

export default function Group() {
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false)
	const [isSearchOpened, setIsSearchOpened] = useState(false)

	const [isTyping, setIsTyping] = useState(false)
	const [typingUserId, setTypingUserId] = useState<string | null>(null)
	const isUserTyping = typingUserId !== null

	const groupId = useParams().groupId
	const userId = authClient.useSession().data?.user?.id

	const {
		data: groupData,
		isError: isGroupsError,
		isLoading: isGroupLoading,
	} = useGetGroups()
	const [groupInfo, setGroupInfo] = useState<GroupResponse>()

	useEffect(() => {
		if (groupData) {
			const group = groupData.groups.find(g => g.group.id === groupId)
			if (group) {
				setGroupInfo(group)
			}
		}
	}, [groupData, groupId])

	const dispatch = useDispatch<AppDispatch>()
	const navigate = useNavigate()

	const [hasScrolled, setHasScrolled] = useState(false)

	useEffect(() => {
		if (!groupInfo && !isGroupLoading && isGroupsError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load group information. Please try again.',
				}),
			)
			navigate('/groups')
		}
	}, [isGroupsError, dispatch])

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
	const [messagesState, setMessagesState] = useState<GroupMessage[]>([])
	const typingUserInfo = messagesState.find(
		message => message.senderInfo.userId === typingUserId,
	)?.senderInfo
	const [oldestMessageElement, setOldestMessageElement] =
		useState<HTMLDivElement | null>(null)
	const [newestMessageElement, setNewestMessageElement] =
		useState<HTMLDivElement | null>(null)

	const {
		data: messages,
		isError: isMessagesError,
		isPending: isMessagesPending,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useGetGroupMessages({
		groupId: groupId as string,
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
	}, [isMessagesError])

	const messagesQueryKey = useMemo(
		() => ['groupMessages', groupId, 'infinite'] as const,
		[groupId],
	)

	const { data: preferences, isError: isPreferencesError } =
		useGetUserPreferences()

	useEffect(() => {
		if (isPreferencesError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load user preferences. Please try again.',
				}),
			)
		}
	}, [isPreferencesError, dispatch])

	const playMessageSound = useMessageSound()

	const { markAsRead } = useGroupSocketEvents({
		groupId: groupId as string,
		userId,
		messageQueryKey: messagesQueryKey,
		messageSoundsEnabled: preferences?.messageSounds || false,
		playMessageSound: playMessageSound,
		setMessages: setMessagesState,
		setTypingUserId,
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
		setMessagesState([])
		pendingScrollAdjustmentRef.current = null
		skipAutoScrollRef.current = false
	}, [groupId])

	useEffect(() => {
		if (messages && !isMessagesPending) {
			setMessagesState(currentMessages => {
				const fetchedMessages = messages.pages.flatMap(page => page.messages)
				const messageMap = new Map<string, GroupMessage>()
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

	const socketError = useSelector(
		(state: RootType) => state.socketState.globalSocketError,
	)

	useEffect(() => {
		if (socketError) {
			navigate('/groups', { replace: true })
		}
	}, [socketError])

	const appTheme = useSelector((state: RootType) => state.theme.mode)
	return (
		<div className='w-full h-full overflow-hidden flex flex-col dark:bg-[#16161b] bg-white border-l border-gray-700/60'>
			<div className='relative p-4 pl-0 shrink-0 flex w-full justify-between items-center border-b border-gray-700/60'>
				<div className='flex justify-center items-center gap-3'>
					{isGroupInfoOpen && (
						<GroupInfo
							groupInfo={groupInfo!}
							setIsProfileOpened={setIsGroupInfoOpen}
						/>
					)}
					<Link
						to='/groups'
						aria-label='Back to groups'
						className={`cursor-pointer transition-all duration-200 ease-in-out rounded-full ml-4 ${appTheme === 'dark' ? 'hover:bg-[#2D2D3B]' : 'hover:bg-[#E5E5EA]'}`}
					>
						<ArrowLeft color='#6B6B80' />
					</Link>
					<button
						type='button'
						onClick={() => setIsGroupInfoOpen(true)}
						className='cursor-pointer hover:outline-2 hover:outline-[#7C5CFC] transition-all duration-200 ease-in-out rounded-2xl'
						aria-label='Open Group information'
					>
						<GroupPfp
							groupName={groupInfo?.group.groupName ?? ''}
							isLoading={isGroupLoading}
						/>
					</button>
					<div className='flex min-w-0 flex-1 flex-col'>
						<p
							className={`${isGroupLoading ? 'skeleton-shimmer' : ''} font-semibold font-inter text-md truncate dark:text-white text-black h-6 min-w-30 rounded-md`}
						>
							{!isGroupLoading && groupInfo?.group.groupName}
						</p>
						<p
							className={`${isGroupLoading ? 'skeleton-shimmer' : ''} text-[#6B6B80] text-[13px] font-inter text-xs h-4 min-w-10 rounded-md capitalize`}
						>
							{!isGroupLoading &&
								(groupInfo?.group.memberIds.length === 1
									? '1 member'
									: `${groupInfo?.group.memberIds.length} members`)}
						</p>
					</div>
				</div>
				<div className='h-full shrink-0 flex justify-center items-center gap-1 md:gap-2'>
					{isGroupLoading ? (
						<div className='w-full h-full flex justify-center items-center'>
							<div
								className='loader'
								role='status'
								aria-label='Loading group information'
							/>
						</div>
					) : (
						<>
							<CallButon
								groupName={groupInfo?.group.groupName ?? ''}
								isGroup={true}
								chatId={groupInfo?.group.id}
								size={16}
							/>
							<VideoCallBtn
								isGroup={true}
								groupName={groupInfo?.group.groupName ?? ''}
								chatId={groupInfo?.group.id}
								size={16}
							/>
							{groupInfo?.group && (
								<MoreInfoButton
									messagesLength={messagesState?.length}
									isAdmin={groupInfo.groupUser.role === 'admin'}
									onSearchClick={setIsSearchOpened}
									isPinned={false}
									isGroup={true}
									chatId={groupInfo.group.id}
								/>
							)}
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
				aria-live='polite'
				aria-relevant='additions'
				aria-label='Group messages'
				className='messages w-full min-h-0 flex-1 flex flex-col-reverse text-white p-5 pb-0 gap-2'
			>
				{
					<ScrollDownBtn
						isVisible={hasScrolled}
						onClick={scrollToLatestMessage}
					/>
				}
				{isMessagesPending ? (
					<div className='w-full h-full flex justify-center items-center'>
						<div
							className='loader'
							role='status'
							aria-label='Loading messages'
						/>
					</div>
				) : !messagesState ? (
					<div className='w-full h-full flex justify-center items-center'>
						<p>Failed to load user information</p>
					</div>
				) : (
					<>
						{!hasScrolled && typingUserInfo && (
							<IsTyping userInfo={typingUserInfo} isTyping={isUserTyping} />
						)}
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
										isGroup
										isFetching={false}
										messageInfo={message}
										userInfo={message.senderInfo}
										isMe={message.senderId === userId}
										chatId={groupId as string}
									/>
								) : (
									<Message
										isGroup
										messageInfo={message}
										isFetching={false}
										userInfo={message.senderInfo}
										isMe={message.senderId === userId}
										chatId={groupId as string}
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
								<div
								className='loader bg-white dark:bg-black'
									role='status'
									aria-label='Loading older messages'
								/>
							</div>
						)}
					</>
				)}
			</div>

			<SendAMessage
				isFromGroup={true}
				setIsTyping={setIsTyping}
				isTyping={isTyping}
				lastMessageAt={new Date()}
				chatId={groupId as string}
			/>
		</div>
	)
}
