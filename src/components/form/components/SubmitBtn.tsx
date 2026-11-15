import { Button } from '@mui/material'

export default function SubmitBtn({
	label,
	onClick,
	isSubmitting,
}: {
	label?: 'Sign In' | 'Create Account'
	onClick?: () => void
	isSubmitting: boolean
}) {
	return (
		<Button
			type='submit'
			variant='contained'
			disabled={isSubmitting}
			aria-busy={isSubmitting}
			onClick={onClick}
			sx={{
				width: '100%',
				borderRadius: '10px',

				marginTop: '10px',

				background: 'linear-gradient(90deg, #7654E8 0%, #5437C9 100%)',

				color: '#fff',
				fontSize: '16px',
				fontWeight: 600,
				padding: '12px 0',
				textTransform: 'none',

				boxShadow: 'none',

				'&:hover': {
					background: 'linear-gradient(90deg, #7654E8 0%, #5437C9 100%)',
					boxShadow: 'none',
				},

				'&:active': {
					transform: 'scale(0.99)',
				},
			}}
		>
			{isSubmitting ? (
				<span
					className='submitLoader'
					role='status'
					aria-label='Submitting'
				/>
			) : (
				label
			)}
		</Button>
	)
}
