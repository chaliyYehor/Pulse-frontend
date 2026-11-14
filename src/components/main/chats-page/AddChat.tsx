import { Button } from '@mui/material'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useFormContext, useWatch, type SubmitHandler } from 'react-hook-form'
import Person from './chat/Person'
import { ChatSearch } from './ChatSearch'
import type { AppDispatch, RootType } from '../../../store/store'
import { useDispatch, useSelector } from 'react-redux'
import type { AddChatType, PersonType } from '../../../schemas/main/addChat'
import { useDebounce } from '../../../hooks/useDebounce'
import { useAddChat } from '../../../hooks/useAddChat'
import { socket } from '../../../socket'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setPopUpError } from '../../../store/slices/popUpSlice'
import { useAccessibleDialog } from '../../../hooks/useAccessibleDialog'
import { useGetCreator } from '../../../hooks/useGetCreator'
import { authClient } from '../../../lib/auth-client'

export default function AddChat({
	setIsAdding,
}: {
	setIsAdding: React.Dispatch<React.SetStateAction<boolean>>
}) {
	const userId = authClient.useSession().data?.user.id

	const { control, handleSubmit } = useFormContext<AddChatType>()

	const [isLoading, setIsLoading] = useState(false)

	const search = useWatch({
		control,
		name: 'search',
	})

	const debouncedSearch = useDebounce(search, 500)

	const {
		data: people,
		isPending,
		isError: isAddChatError,
		isFetching,
	} = useAddChat(debouncedSearch)

	const {
		data: creator,
		isPending: isCreatorPending,
		isError: isCreatorError,
	} = useGetCreator()

	const dispatch = useDispatch<AppDispatch>()

	useEffect(() => {
		if (isAddChatError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load people. Please try again.',
				}),
			)
		}
		if (isCreatorError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load user. Please try again.',
				}),
			)
		}
	}, [isAddChatError, isCreatorError, dispatch])

	const onSubmit: SubmitHandler<AddChatType> = () => {}

	const appTheme = useSelector((state: RootType) => state.theme.mode)

	const queryClient = useQueryClient()

	const navigate = useNavigate()

	const dialogRef = useAccessibleDialog(() => setIsAdding(false))
	const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase()
	const visiblePeople: PersonType[] = [...(people ?? [])]
	if (
		normalizedSearch &&
		creator &&
		creator.userId !== userId &&
		creator.name.toLocaleLowerCase().includes(normalizedSearch) &&
		!visiblePeople.some(person => person.userId === creator.userId)
	) {
		visiblePeople.push(creator)
	}

	return createPortal(
		<div
			ref={dialogRef}
			onClick={() => {
				setIsAdding(false)
			}}
			role='dialog'
			aria-modal='true'
			aria-labelledby='new-message-title'
			tabIndex={-1}
			className='fixed w-screen h-dvh cursor-pointer inset-0 bg-black/70 flex md:items-start justify-center z-100 backdrop-blur-xs'
		>
			<div className='relative flex justify-center w-full px-1'>
				<div
					onClick={e => e.stopPropagation()}
					className='addChat cursor-default dark:bg-[#16161B] bg-white md:w-100 flex flex-col border border-white/50 rounded-3xl md:rounded-2xl overflow-hidden animate-fade-in my-auto md:my-20 md:max-h-142.5 h-[80vh] p-3'
				>
					<div className='flex justify-between items-center px-4 py-3 border-b border-white/10 relative'>
						<div className='flex flex-col items-start text-start'>
							<h2
								id='new-message-title'
								className='dark:text-[#F0F0F5] font-inter text-[20px] font-bold text-base'
							>
								New Message
							</h2>
							<p className='text-[#6B6B80] font-inter text-sm mt-0.5'>
								Choose a contact to start a chat
							</p>
						</div>
						<Button
							variant='contained'
							type='button'
							onClick={() => setIsAdding(false)}
							sx={{
								width: 32,
								minWidth: 0,
								height: 32,
								padding: 0,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: appTheme === 'dark' ? '#1E1E26' : '#f0f0f4',
								border: 'none',
								color: appTheme === 'dark' ? '#F0F0F5' : '#6B6B80',
								cursor: 'pointer',
								transition: '0.3s ease',
								'&:hover': {
									color: appTheme === 'dark' ? 'white' : 'black',
								},
							}}
							aria-label='Close new message dialog'
						>
							<X size={16} />
						</Button>
					</div>
					<form
						onSubmit={handleSubmit(onSubmit)}
						className='flex justify-between items-center border-b border-white/10 py-4'
					>
						<ChatSearch isChatSearch control={control} name='search' />
					</form>
					{isLoading || (isPending && isFetching) || isCreatorPending ? (
						<div className='flex-1 min-h-0 w-full flex justify-center items-center'>
							<div
								className='loader'
								role='status'
								aria-label={isLoading ? 'Opening chat' : 'Loading contacts'}
							/>
						</div>
					) : normalizedSearch ? (
						<div className='suggestedPeople p-2'>
							{visiblePeople.length > 0 ? (
								visiblePeople.map(person => (
									<Person
										key={person.userId}
										isLoading={isLoading}
										setIsAdding={() => {
											setIsLoading(true)
											socket.emit(
												'chat:create-chat',
												{ userId: person.userId },
												async ({
													success,
													error,
													conversationId,
												}: {
													success: boolean
													error?: string
													conversationId?: string
												}) => {
													if (success) {
														console.log('Chat created successfully')
														await queryClient.invalidateQueries({
															queryKey: ['chats'],
														})
														setIsAdding(false)
														setIsLoading(false)
														navigate(`/chats/${conversationId}`)
													}
													if (error) {
														setIsLoading(false)

														if (error.includes('already exists')) {
															setIsAdding(false)
															navigate(`/chats/${conversationId}`)
														} else {
															dispatch(
																setPopUpError({
																	heading: 'Error',
																	text: 'Failed to create chat. Please try again.',
																}),
															)
														}
													}
												},
											)
										}}
										user={person}
									/>
								))
							) : (
								<p className='text-[#6B6B80] font-inter text-sm  px-4 text-center font-mono'>
									No Contacts were found
								</p>
							)}
						</div>
					) : creator && creator.userId !== userId ? (
						<div className='suggestedPeople p-2'>
							<Person
								isCreator
								key={creator?.userId}
								isLoading={isLoading}
								setIsAdding={() => {
									setIsLoading(true)
									socket.emit(
										'chat:create-chat',
										{ userId: creator?.userId },
										async ({
											success,
											error,
											conversationId,
										}: {
											success: boolean
											error?: string
											conversationId?: string
										}) => {
											if (success) {
												console.log('Chat created successfully')
												await queryClient.invalidateQueries({
													queryKey: ['chats'],
												})
												setIsAdding(false)
												setIsLoading(false)
												navigate(`/chats/${conversationId}`)
											}
											if (error) {
												setIsLoading(false)

												if (error.includes('already exists')) {
													setIsAdding(false)
													navigate(`/chats/${conversationId}`)
												} else {
													dispatch(
														setPopUpError({
															heading: 'Error',
															text: 'Failed to create chat. Please try again.',
														}),
													)
												}
											}
										},
									)
								}}
								user={creator!}
							/>
						</div>
					) : (
						<p className='text-[#6B6B80] font-inter text-sm mt-2 px-4 text-center font-mono'>
							No Contacts were found
						</p>
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}
