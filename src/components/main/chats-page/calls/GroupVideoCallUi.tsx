import GroupVideoCallParticipant from '../groups/GroupVideoCallParticipant'
import Dial from './Dial'
import Badge from '../Badge'
import CallBadge from './CallBadge'
import {
	RoomAudioRenderer,
	useRoomContext,
	useTracks,
	VideoTrack,
} from '@livekit/components-react'
import { useEffect, useState } from 'react'
import { LogLevel, RoomEvent, setLogLevel, Track } from 'livekit-client'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGetGroupMembers } from '../../../../hooks/useGetGroupMembers'
import { useGetGroups } from '../../../../hooks/useGetGroups'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootType } from '../../../../store/store'
import { setPopUpError } from '../../../../store/slices/popUpSlice'
import type { GetGroupMembersResponse } from '../../../../schemas/main/getGroupMembersResponse'
import { User } from 'lucide-react'

export default function ({
	groupId,
	callId,
	callStartedAt,
	serverTimeOffset,
}: {
	groupId: string
	callId: string
	callStartedAt: number
	serverTimeOffset: number
}) {
	const room = useRoomContext()
	const [now, setNow] = useState(() => Date.now())
	const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)

	useEffect(() => {
		const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(intervalId)
	}, [])

	const elapsedSeconds = Math.max(
		0,
		Math.floor((now + serverTimeOffset - callStartedAt) / 1000),
	)
	const duration = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`

	const locationState: unknown = useLocation().state
	const routeName =
		typeof locationState === 'string'
			? locationState
			: locationState &&
				  typeof locationState === 'object' &&
				  'name' in locationState &&
				  typeof locationState.name === 'string'
				? locationState.name
				: undefined
	const { data: groupsData } = useGetGroups()
	const name =
		routeName ||
		groupsData?.groups.find(group => group.group.id === groupId)?.group
			.groupName ||
		'Group video call'

	const {
		data: groupMembers,
		isPending: isGroupMembersLoading,
		isError: isGroupMembersError,
	} = useGetGroupMembers(groupId)

	const dispatch = useDispatch<AppDispatch>()

	const navigate = useNavigate()

	useEffect(() => {
		if (isGroupMembersError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'Failed to load call members. Please try again.',
				}),
			)
		}
	}, [isGroupMembersError, dispatch])

	const [participants, setParticipants] = useState(() => [
		room.localParticipant,
		...room.remoteParticipants.values(),
	])
	const [filteredParticipants, setFilteredParticipants] =
		useState<GetGroupMembersResponse>([])

	const [activeParticipantId, setActiveParticipantId] = useState<string | null>(
		null,
	)

	const isSocketError = useSelector((state: RootType) => state.socketState.globalSocketError)

	useEffect(() => {
		if (isSocketError) {
			dispatch(
				setPopUpError({
					heading: 'Error',
					text: 'A socket error occurred. Please try again.',
				}),
			)
			navigate(-1)
		}
	}, [isSocketError])

	useEffect(() => {
		if (!groupMembers) return
		const participantsArray = [
			room.localParticipant,
			...room.remoteParticipants.values(),
		]

		const connectedGroupMembers = groupMembers.filter(member => {
			return participantsArray.some(par => par.identity === member.userId)
		})
		setFilteredParticipants(connectedGroupMembers)

		setActiveParticipantId(currentId => {
			if (
				currentId &&
				connectedGroupMembers.some(member => member.userId === currentId)
			) {
				return currentId
			}
			const nextParticipant =
				(connectedGroupMembers.length > 1 &&
					participantsArray.find(participant => !participant.isLocal)) ||
				participantsArray.find(participant => participant.isLocal)

			return nextParticipant?.identity ?? null
		})
	}, [participants, groupMembers])

	setLogLevel(LogLevel.silent)

	useEffect(() => {
		const syncParticipants = () => {
			setParticipants([
				room.localParticipant,
				...room.remoteParticipants.values(),
			])
		}

		room.on(RoomEvent.Connected, syncParticipants)
		room.on(RoomEvent.ConnectionStateChanged, syncParticipants)
		room.on(RoomEvent.ParticipantConnected, syncParticipants)
		room.on(RoomEvent.ParticipantDisconnected, syncParticipants)
		room.on(RoomEvent.TrackPublished, syncParticipants)
		room.on(RoomEvent.TrackSubscribed, syncParticipants)
		room.on(RoomEvent.TrackMuted, syncParticipants)
		room.on(RoomEvent.TrackUnmuted, syncParticipants)

		syncParticipants()

		const timeoutId = window.setTimeout(syncParticipants, 500)

		return () => {
			window.clearTimeout(timeoutId)

			room.off(RoomEvent.Connected, syncParticipants)
			room.off(RoomEvent.ConnectionStateChanged, syncParticipants)
			room.off(RoomEvent.ParticipantConnected, syncParticipants)
			room.off(RoomEvent.ParticipantDisconnected, syncParticipants)
			room.off(RoomEvent.TrackPublished, syncParticipants)
			room.off(RoomEvent.TrackSubscribed, syncParticipants)
			room.off(RoomEvent.TrackMuted, syncParticipants)
			room.off(RoomEvent.TrackUnmuted, syncParticipants)
		}
	}, [room])

	const cameraTracks = useTracks([Track.Source.Camera])
	const screenShareTracks = useTracks([Track.Source.ScreenShare])

	const activeScreenShareTrack = screenShareTracks.find(
		track =>
			track.participant.identity === activeParticipantId &&
			!track.publication.isMuted,
	)
	const activeCameraTrack = cameraTracks.find(
		track =>
			track.participant.identity === activeParticipantId &&
			!track.publication.isMuted,
	)
	const trackToDisplay = activeScreenShareTrack ?? activeCameraTrack
	const activeUser = filteredParticipants.find(
		participant => participant.userId === activeParticipantId,
	)
	const isActiveParticipantMicOn =
		participants.find(
			participant => participant.identity === activeParticipantId,
		)?.isMicrophoneEnabled ?? false

	return (
		<div>
			<RoomAudioRenderer muted={isSpeakerMuted} />
			<div className='group-video-call w-screen h-dvh dark:bg-black bg-white flex flex-col gap-4 px-5 py-5 items-center justify-between'>
				<div className='w-full flex justify-between items-center gap-1.5 sm:gap-2'>
					<div className=''>
						<span className='font-mono text-[10px] md:text-[12px] text-[#6B6B80] uppercase select-none'>
							GROUP VIDEO CALL
						</span>
						<div className='flex items-center w-fit gap-1.5 sm:gap-3'>
							<h2 className='dark:text-white mt-0.5 sm:mt-1 self-end text-black font-bold font-inter text-base sm:text-2xl md:text-3xl whitespace-nowrap'>
								{name}
							</h2>
							<div className='size-1.5 sm:size-2 rounded-full self-end my-auto bg-[#00D4AA]' />
							<p className='text-[#6B6B80] mt-0.5 sm:mt-1 font-mono text-xs sm:text-lg whitespace-nowrap'>
								{duration}
							</p>
						</div>
					</div>
					<CallBadge text={`${participants.length} participants`} />
				</div>

				<div className='group-video-call-content w-full flex flex-1 min-h-0 flex-col md:flex-row gap-4'>
					<div className='group-video-call-focus w-full md:flex-1 min-h-0'>
						<div className='bg-[#7C5CFC]/5 border-[#000000]/8 h-full w-full min-h-0 flex-1 flex flex-col justify-between items-center overflow-hidden shadow-2xl shadow-[#000000]/25 border dark:border-[#FFFFFF]/7 rounded-3xl p-3 sm:p-5'>
							<div className='font-mono w-fit rounded-full dark:text-white border border-[#000000]/8 dark:border-white/7 dark:bg-[#16161B] p-2 text-[12px] py-1 bg-[#FFFFFF] letter-spacing-[0.5px] shadow-md flex justify-center items-center gap-2 self-start'>
								<div className='size-2 rounded-full self-end my-auto bg-[#00D4AA]' />
								<span className='uppercase select-none text-shadow-2xs'>
									IN FOCUS
								</span>
							</div>

							<div className='w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-2xl'>
								{trackToDisplay ? (
									<VideoTrack
										trackRef={trackToDisplay}
										className='w-full h-full object-cover'
									/>
								) : (
									<div className='flex flex-col gap-2 sm:gap-3 justify-center items-center'>
										<div
											className={`w-20 h-20 sm:w-30 sm:h-30 rounded-[50%] dark:text-white flex justify-center items-center border-2 border-gray-700 relative shrink-0`.trim()}
										>
											{activeUser?.imageUrl ? (
												<img
													src={activeUser.imageUrl}
													alt='Profile'
													className='w-full h-full object-cover rounded-[50%]'
												/>
											) : (
												<User />
											)}
										</div>
										<Badge
											noMargin
											text={isActiveParticipantMicOn ? 'SPEAKING' : 'LISTENING'}
										/>
									</div>
								)}
							</div>

							<div className='self-start'>
								<h2 className='dark:text-white mt-2 sm:mt-5 text-black font-bold font-inter text-xl sm:text-2xl md:text-3xl'>
									{activeUser?.name}
								</h2>
								<p className='text-[#6B6B80] mt-1 font-mono text-sm sm:text-md'>
									Presenting to the group
								</p>
							</div>
						</div>
					</div>
					<div className='group-video-call-participants w-full h-[46%] md:w-[30%] md:h-full min-h-0 shrink-0'>
						<div className='dark:bg-[#101014] bg-[#FFFFFF] h-full w-full min-h-0 flex flex-col gap-3 sm:gap-5 items-center overflow-hidden shadow-2xl shadow-[#000000]/25 border border-[#FFFFFF]/7 rounded-3xl p-3 sm:p-5'>
							<p className='dark:text-white self-start text-black font-bold font-inter text-lg sm:text-xl'>
								All participants
							</p>
							<ul className='w-full flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto scrollbar-none rounded-md'>
								{isGroupMembersLoading ? (
									<li className='flex items-center justify-center py-2'>
										<p className='text-[#6B6B80]'>Loading...</p>
									</li>
								) : (
									filteredParticipants.map(participant => {
										const isCameraOn = participants.find(
											par => par.identity === participant.userId,
										)?.isCameraEnabled
										const isMicOn = participants.find(
											par => par.identity === participant.userId,
										)?.isMicrophoneEnabled

										const isInFocus = participant.userId === activeParticipantId

										return (
											<GroupVideoCallParticipant
												key={participant.userId}
												isInFocus={isInFocus}
												onClick={setActiveParticipantId}
												userInfo={participant}
												isCameraOn={isCameraOn ?? false}
												isMicOn={isMicOn ?? false}
											/>
										)
									})
								)}
							</ul>
						</div>
					</div>
				</div>
				<div className='flex items-center gap-4 rounded-full border border-black/8 bg-white/90 px-3 py-3 shadow-2xl shadow-black/15 mb-5 dark:border-white/6 dark:bg-[#111115]/95 dark:shadow-black/50'>
					<Dial
						type='volume'
						isVolumeMuted={isSpeakerMuted}
						onVolumeToggle={() => setIsSpeakerMuted(value => !value)}
					/>
					<Dial type='microphone' />
					<Dial type='endCall' callId={callId} />
					<Dial type='shareScreen' />
					<Dial type='camera' />
					<Dial type='cameraSwitch' />
				</div>
			</div>
		</div>
	)
}
