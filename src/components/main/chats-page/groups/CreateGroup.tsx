import { InputAdornment, TextField } from '@mui/material'
import Button from '@mui/material/Button'
import { Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
	useFieldArray,
	useFormContext,
	useWatch,
	type SubmitHandler,
} from 'react-hook-form'
import type { GroupCreation } from '../../../../schemas/main/groupCreation'
import CreateGroupBtn from './CreateGroupBtn'
import PickPerson from './PickPerson'
import type { AppDispatch, RootType } from '../../../../store/store'
import { useDispatch, useSelector } from 'react-redux'
import { useAccessibleDialog } from '../../../../hooks/useAccessibleDialog'
import { useGetChats } from '../../../../hooks/useGetChats'
import { authClient } from '../../../../lib/auth-client'
import { useEffect, useState } from 'react'
import { socket } from '../../../../socket'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { setPopUpError } from '../../../../store/slices/popUpSlice'
import type { ChatsResponse } from '../../../../schemas/main/getChatsResponse'
import { useDebounce } from '../../../../hooks/useDebounce'

export default function CreateGroup({
	setIsAdding,
}: {
	setIsAdding: React.Dispatch<React.SetStateAction<boolean>>
}) {
	const {
		control,
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useFormContext<GroupCreation>()

	function closeCreateGroup() {
		reset({ groupName: '', peopleToAdd: [] })
		setIsAdding(false)
	}

	const [isLoading, setIsLoading] = useState(false)

	const { fields, append, remove } = useFieldArray({
		control,
		name: 'peopleToAdd',
		keyName: 'fieldId',
	})

	const userId = authClient.useSession().data?.user.id

	const { data: peopleData, isPending: isPeopleLoading } = useGetChats()
	const [people, setPeople] = useState<ChatsResponse>([])

	const [search, setSearch] = useState('')
	const debouncedSearch = useDebounce(search, 300)

	useEffect(() => {
		if (peopleData) {
			setPeople(peopleData)
		}
	}, [peopleData])

	useEffect(() => {
		const query = debouncedSearch.trim().toLocaleLowerCase()

		if (!query) {
			setPeople(peopleData ?? [])
			return
		}

		setPeople(
			(peopleData ?? []).filter(chat => {
				const person =
					chat.userOne?.userId === userId ? chat.userTwo : chat.userOne

				return person?.name.toLocaleLowerCase().includes(query) ?? false
			}),
		)
	}, [debouncedSearch, peopleData, userId])

	const watchFields = useWatch({
		control,
		name: ['peopleToAdd'],
	})

	const queryClient = useQueryClient()

	const navigate = useNavigate()

	const dispatch = useDispatch<AppDispatch>()

	const onSubmit: SubmitHandler<GroupCreation> = data => {
		setIsLoading(true)
		socket.emit(
			'group:create-group',
			data,
			async ({
				success,
				error,
				groupId,
			}: {
				success: boolean
				error: string | null
				groupId: string
			}) => {
				if (success) {
					await queryClient.invalidateQueries({ queryKey: ['groups'] })
					setIsLoading(false)
					closeCreateGroup()
					navigate(`/groups/${groupId}`)
				}

				if (error) {
					setIsLoading(false)

					dispatch(
						setPopUpError({
							heading: 'Error',
							text: 'Failed to create group. Please try again.',
						}),
					)
				}
			},
		)
	}

	const appTheme = useSelector((state: RootType) => state.theme.mode)
	const dialogRef = useAccessibleDialog(closeCreateGroup)
	return createPortal(
		<div
			ref={dialogRef}
			onClick={() => {
				closeCreateGroup()
			}}
			role='dialog'
			aria-modal='true'
			aria-labelledby='new-group-title'
			tabIndex={-1}
			className='fixed w-screen h-dvh cursor-pointer inset-0 bg-black/70 flex md:items-start justify-center z-50 backdrop-blur-xs'
		>
			<div
				className='relative flex w-full justify-center px-1'
			>
				<div onClick={e => e.stopPropagation()} className='addChat cursor-default dark:bg-[#16161B] bg-white md:w-100 md:h-142.5 h-[80vh] flex flex-col border border-white/50 rounded-3xl md:rounded-2xl overflow-hidden animate-fade-in my-20 p-3'>
					<div className='flex justify-between items-center px-4 py-3 border-b dark:border-white/10 border-black/10 relative'>
						<div className='flex flex-col items-start text-start'>
							<h2
								id='new-group-title'
								className='dark:text-[#F0F0F5] font-inter text-[20px] font-bold text-base'
							>
								New Group
							</h2>
							<p className='text-[#6B6B80] font-inter text-sm mt-0.5'>
								Name your group and choose members
							</p>
						</div>
						<Button
							variant='contained'
							type='button'
							onClick={closeCreateGroup}
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
								color: '#6B6B80',
								cursor: 'pointer',
								transition: '0.3s ease',
								'&:hover': {
									color: appTheme === 'dark' ? 'white' : 'black',
								},
							}}
							aria-label='Close new group dialog'
						>
							<X size={16} />
						</Button>
					</div>
					<form
						onSubmit={handleSubmit(onSubmit)}
						className='flex flex-col flex-1 min-h-0 justify-between items-center border-b border-white/10 pt-4'
					>
						<div className='w-full border-b border-white/10 pb-4 flex flex-col gap-2'>
							<TextField
								variant='outlined'
								autoComplete='off'
								placeholder={'Group name'}
								{...register('groupName')}
								slotProps={{
									htmlInput: {
										'aria-label': 'group name',
									},
								}}
								error={!!errors.groupName}
								helperText={errors.groupName?.message}
								sx={{
									width: '100%',
									paddingInline: '15px',
									transition: 'all 0.2s ease-in-out',
									'& .MuiOutlinedInput-root': {
										borderRadius: '10px',
										backgroundColor:
											appTheme === 'dark' ? '#1f1f26' : '#ebebf0',
										height: '46px',

										'& .MuiOutlinedInput-notchedOutline': {
											borderColor: appTheme === 'dark' ? '#333' : '#ccc',
										},

										'&:hover .MuiOutlinedInput-notchedOutline': {
											borderColor: '#444',
										},

										'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
											borderColor: '#333',
											borderWidth: '1px',
										},
									},

									'& .MuiInputBase-input': {
										color: appTheme === 'dark' ? '#eee' : '#333',
									},
								}}
							/>
							<TextField
								variant='outlined'
								autoComplete='off'
								value={search}
								onChange={e => setSearch(e.target.value)}
								placeholder={'Search contacts...'}
								slotProps={{
									input: {
										startAdornment: (
											<InputAdornment position='start'>
												<Search size={20} color='#6B6B80' />
											</InputAdornment>
										),
									},
									htmlInput: {
										'aria-label': 'Search contacts',
									},
								}}
								sx={{
									width: '100%',
									paddingInline: '15px',
									'& .MuiOutlinedInput-root': {
										borderRadius: '10px',
										backgroundColor:
											appTheme === 'dark' ? '#1f1f26' : '#ebebf0',
										height: '46px',

										'& .MuiOutlinedInput-notchedOutline': {
											borderColor: '#333',
										},

										'&:hover .MuiOutlinedInput-notchedOutline': {
											borderColor: appTheme === 'dark' ? '#333' : '#ccc',
										},

										'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
											borderColor: '#333',
											borderWidth: '1px',
										},
									},

									'& .MuiInputBase-input': {
										color: appTheme === 'dark' ? '#eee' : '#333',
									},
								}}
							/>
						</div>

						<div className='w-full suggestedPeople min-h-0 p-2 flex flex-1 flex-col gap-1 overflow-y-auto'>
							{!isPeopleLoading &&
								people &&
								people.map(person => {
									const p =
										person.userOne?.userId === userId
											? person.userTwo
											: person.userOne
									if (!p) return null

									const selectedIndex = fields.findIndex(
										field => field.id === p.userId,
									)

									return (
										<PickPerson
											key={p.userId}
											person={p}
											isPicked={selectedIndex !== -1}
											add={append}
											remove={remove}
											selectedIndex={selectedIndex}
										/>
									)
								})}
							{isPeopleLoading && (
								<div className='flex justify-center items-center h-full'>
									<div className='loader bg-white dark:bg-black' />
								</div>
							)}
						</div>

						<div className='w-full shrink-0'>
							<CreateGroupBtn
								isLoading={isLoading}
								numberOfMembers={watchFields[0]?.length || 0}
								isDisabled={watchFields[0]?.length < 2}
							/>
						</div>
					</form>
				</div>
			</div>
		</div>,
		document.body,
	)
}
