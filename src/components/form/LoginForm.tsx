import { Box } from '@mui/material'
import { useFormContext, useFormState, type SubmitHandler } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '../../lib/auth-client'
import type { LoginType } from '../../schemas/auth/login'
import FormTextField from './components/FormTextField'
import Label from './components/Label'
import SubmitBtn from './components/SubmitBtn'

interface Props {
	globalError: string
	setGlobalError: React.Dispatch<React.SetStateAction<string>>
}

export default function LoginForm({ globalError, setGlobalError }: Props) {
	const navigate = useNavigate()

	const {
		control,
		handleSubmit,
		reset,
	} = useFormContext<LoginType>()
	const { isSubmitting } = useFormState({ control })

	const onSubmit: SubmitHandler<LoginType> = async data => {
		const { email, password } = data

		const { error } = await authClient.signIn.email(
			{ email, password },
			{
				onSuccess: () => {
					navigate('/chats', { replace: true })
				},
			},
		)

		if (error) {
			setGlobalError(error.message!)
			return
		}

		reset()
	}

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				gap: '10px',
			}}
		>
			<form className='flex flex-col gap-2.5' onSubmit={handleSubmit(onSubmit)}>
				<div>
					<Label text='EMAIL' htmlFor='email' />
					<FormTextField
						control={control}
						name='email'
						type='email'
						label='you@example.com'
						ariaLabel='Email address'
						autoComplete='email'
					/>
				</div>
				<div>
					<div className='flex justify-between items-center'>
						<Label text='PASSWORD' htmlFor='password' />
						<Link
							to='/forgotPassword'
							aria-label='Forgot password'
							className='text-[#7C5CFC] text-sm font-medium hover:underline cursor-pointer'
						>
							Forgot password?
						</Link>
					</div>
					<FormTextField
						control={control}
						name='password'
						type='password'
						ariaLabel='Password'
						autoComplete='current-password'
						label='••••••••'
					/>
				</div>

				<SubmitBtn isSubmitting={isSubmitting} label='Sign In' />

				<p
					className='mt-1 min-h-5 first-letter:capitalize select-none text-sm text-red-500 dark:text-red-400 text-center'
					role='alert'
				>
					{globalError || '\u00A0'}
				</p>
			</form>
		</Box>
	)
}
