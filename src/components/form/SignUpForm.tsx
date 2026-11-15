import { Box } from '@mui/material'
import { useFormContext, useFormState, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { authClient } from '../../lib/auth-client'
import type { SignUpType } from '../../schemas/auth/signUp'
import FormTextField from './components/FormTextField'
import Label from './components/Label'
import SubmitBtn from './components/SubmitBtn'

interface Props {
	globalError: string
	setGlobalError: React.Dispatch<React.SetStateAction<string>>
}

export default function SignUpForm({ globalError, setGlobalError }: Props) {
	const navigate = useNavigate()

	const {
		control,
		handleSubmit,
		reset,
	} = useFormContext<SignUpType>()
	const { isSubmitting } = useFormState({ control })

	const onSubmit: SubmitHandler<SignUpType> = async data => {
		const { name, email, password } = data

		const { error } = await authClient.signUp.email({
			email,
			password,
			name,
			callbackURL: `${window.location.origin}/login`,
		})

		if (error) {
			setGlobalError(error.message!)
			return
		}
		reset()
		navigate('/verify')
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
			<form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-2.5'>
				<div className='registrationAnim'>
					<Label text='FULL NAME' htmlFor='name' />
					<FormTextField
						control={control}
						name='name'
						type='text'
						ariaLabel='Full name'
						autoComplete='name'
						label='Your name'
					/>
				</div>
				<div className='registrationAnim'>
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
				<div className='registrationAnim'>
					<Label text='PASSWORD' htmlFor='password' />
					<FormTextField
						control={control}
						name='password'
						type='password'
						ariaLabel='Password'
						autoComplete='new-password'
						label='••••••••'
					/>
				</div>
				<div className='registrationAnim'>
					<Label text='CONFIRM PASSWORD' htmlFor='confirmPassword' />
					<FormTextField
						control={control}
						name='confirmPassword'
						type='password'
						ariaLabel='Confirm password'
						autoComplete='new-password'
						label='••••••••'
					/>
				</div>

				<SubmitBtn label='Create Account' isSubmitting={isSubmitting} />

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
