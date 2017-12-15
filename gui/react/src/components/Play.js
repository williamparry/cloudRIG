import React, { Component } from 'react';
import { Button, Grid, List, Image, Table, Divider, Icon, Modal } from 'semantic-ui-react'
import Loading from './Loading';
import ParsecLogo from '../img/parsec_logo.svg'
import DiscordIcon from '../img/discord_icon.svg'
import Storage from './play/Storage'

const { ipcRenderer } = window.require('electron');

let stateTimeout;

let config;

class Play extends Component {

	constructor() {

		super();

		this.state = {
			isLoading: true,
			immediateIsStarting: false,
			immediateIsStopping: false,
			manageDrivesOpen: false,
			volumesInAZ: [],
			volumesNotInAZ: [],
			errorMessage: "",
			cloudRIGState: {
				activeInstance: null,
				instanceReady: false,
				instanceStopping: false,
				scheduledStop: null,
				currentSpotPrice: null,
				remainingTime: null,
				savingInstance: null
			}
		}

		config = ipcRenderer.sendSync('cmd', 'getConfiguration');

		ipcRenderer.on('starting', (event, isStarting) => {
			this.setState({
				immediateIsStarting: isStarting
			})
		})

		ipcRenderer.on('stopping', (event, isStopping) => {
			this.setState({
				immediateIsStopping: isStopping
			})
		})
		
		ipcRenderer.on('errorPlay', (event, err) => {

			ipcRenderer.send('cmd', 'error', err)

			this.setState({
				immediateIsStarting: false,
				immediateIsStopping: false
			})
		});

		ipcRenderer.on('gotState', (event, state) => {
			
			if(!state.currentSpotPrice) {
				event.sender.send('cmd', 'error', 'This Availability Zone does not appear to have a spot price. Please select another in Configuration.')
				ipcRenderer.send('cmd', 'changePage', 1)
				return;
			}

			let volumesInAZ = [];
			let volumesNotInAZ = [];

			state.volumes.forEach((v) => {
				if(v.AvailabilityZone === config.AWSAvailabilityZone) {
					volumesInAZ.push(v)
				} else {
					volumesNotInAZ.push(v)
				}
			})

			this.setState({
				volumesInAZ: volumesInAZ,
				volumesNotInAZ: volumesNotInAZ,
				cloudRIGState: state
			})

			ipcRenderer.send('cmd', 'disableNonPlay', 
				this.state.immediateIsStarting || 
				this.state.immediateIsStopping ||
				this.state.cloudRIGState.savingInstance ||
				this.state.cloudRIGState.instanceStopping || 
				!!this.state.cloudRIGState.activeInstance)

			stateTimeout = setTimeout(() => {
				ipcRenderer.send('cmd', 'getState')
			}, 5000)

		});

	}

	componentWillUnmount() {

		ipcRenderer.removeAllListeners('starting')
		ipcRenderer.removeAllListeners('stopping')
		ipcRenderer.removeAllListeners('gotState')
		ipcRenderer.removeAllListeners('errorPlay')

		clearTimeout(stateTimeout)
		
	}

	start() { ipcRenderer.send('cmd', 'start') }

	stop() { ipcRenderer.send('cmd', 'stop') }

	scheduleStop() { ipcRenderer.send('cmd', 'scheduleStop') }

	unScheduleStop() { ipcRenderer.send('cmd', 'unScheduleStop') }

	manageDrivesOpen() {

		this.setState({
			manageDrivesOpen: true
		})
	}

	manageDrivesClose() {
		
		this.setState({
			manageDrivesOpen: false
		})
	}

	addStorage(size) {
		
		ipcRenderer.send('cmd', 'addStorage', {
			availabilityZone: config.AWSAvailabilityZone,
			size: size
		});

	}

	deleteStorage(volume) {
		ipcRenderer.send('cmd', 'deleteStorage', volume.VolumeId);
	}

	openVNC() {
		ipcRenderer.send('cmd', 'openVNC');
	}

	componentDidMount() {

		this.setState({
			isLoading: true
		});

		ipcRenderer.once('gotState', (event, state) => {
			
			event.sender.send('cmd', 'log', '✓ Ready')

			this.setState({
				isLoading: false
			});

		});

		ipcRenderer.send('cmd', 'getState')

	}
	
	render() {

		let actionButtons;

		if(this.state.cloudRIGState.savingInstance || (this.state.cloudRIGState.savingInstance && this.state.immediateIsStopping)) {

			actionButtons = <div><Button content='Saving...' icon='save' labelPosition='right' disabled /></div>

		} else if(this.state.cloudRIGState.instanceReady || this.state.cloudRIGState.instanceStopping) {
			
			if(!this.state.cloudRIGState.instanceStopping && !this.state.immediateIsStopping) {
				actionButtons = <div>
					<Button content='Stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} />
					{this.state.cloudRIGState.scheduledStop ?
						(<Button content='Unscheduled Stop' icon='time' labelPosition='right' onClick={this.unScheduleStop.bind(this)} />)
						:
						(<Button content='Schedule Stop' icon='time' labelPosition='right' onClick={this.scheduleStop.bind(this)} />)}
					<Button content='Open VNC' icon='external' labelPosition='right' onClick={this.openVNC.bind(this)} />
				</div>
			} else {
				actionButtons = <div>
					<Button content='Stopping' icon='stop' labelPosition='right' disabled />
				</div>
			}

		} else {
			
			if(!this.state.cloudRIGState.instanceReady) {

				if(!this.state.cloudRIGState.activeInstance && !this.state.immediateIsStarting) {

					let manageAction = this.state.volumesInAZ.length > 0 ? 'Manage storage' : 'Add storage'
					

					actionButtons = 
					<div>
						<Button content='Start' icon='play' labelPosition='right' onClick={this.start.bind(this)} />

						<Modal open={this.state.manageDrivesOpen} onClose={this.manageDrivesClose.bind(this)} closeIcon trigger={<Button onClick={this.manageDrivesOpen.bind(this)} content={manageAction} icon='hdd outline' labelPosition='right' />}>
							<Modal.Header><Icon name='hdd outline' /> {manageAction}</Modal.Header>
							<Modal.Content>
								<Modal.Description>
									<Storage volumesNotInAZ={this.state.volumesNotInAZ} volumesInAZ={this.state.volumesInAZ} handleSubmit={this.addStorage.bind(this)} handleDelete={this.deleteStorage.bind(this)} />
								</Modal.Description>
							</Modal.Content>
						</Modal>
					</div>
				} else {
					actionButtons = <div><Button content='Starting...' icon='play' labelPosition='right' disabled /></div>
				}

			}

		}

		if(this.state.isLoading) {

			return(<Loading message="Setting up" />)

		} else {

			const readyCell = this.state.cloudRIGState.instanceReady ? <Icon name='circle' color='green' /> : '-'

			const stoppingCell = this.state.cloudRIGState.instanceStopping ? <Icon name='circle' color='red' /> : '-'

			const savingCell = this.state.cloudRIGState.savingInstance ? <Icon loading name='spinner' /> : '-'

			const remainingCell = this.state.cloudRIGState.scheduledStop ? this.state.cloudRIGState.remainingTime + ' mins' : '-'

			const spotCell = this.state.cloudRIGState.currentSpotPrice;

			return(

				<Grid>
					<Grid.Row>
						<Grid.Column width={10}>
							{actionButtons}
							<br /><br />
							<iframe title="Watch Parsec videos" src="https://www.youtube.com/embed?listType=user_uploads&amp;list=jamesstringerphoto" width="100%" height="265" frameBorder='0'></iframe> 
						</Grid.Column>
						<Grid.Column width={6}>

							<Table definition>

								<Table.Body>
									<Table.Row>
										<Table.Cell>Ready</Table.Cell>
										<Table.Cell>{readyCell}</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Stopping</Table.Cell>
										<Table.Cell>{stoppingCell}</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Saving</Table.Cell>
										<Table.Cell>{savingCell}</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Remaining time</Table.Cell>
										<Table.Cell>{remainingCell}</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Current Spot Price</Table.Cell>
										<Table.Cell>${spotCell}</Table.Cell>
									</Table.Row>

								</Table.Body>
							</Table>	

							<List>
								<List.Item>
										<Image width="14" src={DiscordIcon} verticalAlign="middle" style={{marginRight: 4}} />
										<List.Content><a href='https://discordapp.com/invite/3TS2emF' target='_blank' rel='noopener noreferrer'>Discord (javagoogles)</a></List.Content>
									</List.Item>
								<List.Item>
									<List.Icon name='mail' />
									<List.Content><a href='mailto:williamparry@gmail.com' target='_blank' rel='noopener noreferrer'>williamparry@gmail.com</a></List.Content>
								</List.Item>
								<List.Item>
									<List.Icon name='github' />
									<List.Content>
										<a href='https://github.com/williamparry/cloudRIG' target='_blank' rel='noopener noreferrer'>Github</a>
									</List.Content>
								</List.Item>
								
							</List>

							<Divider horizontal><small>Powered by</small></Divider>
							<a href='https://parsecgaming.com' target='_blank' rel='noopener noreferrer'>
								<Image width="100" src={ParsecLogo} />
							</a>

						</Grid.Column>

					</Grid.Row>

				</Grid>

			)
		}

		

	}

}

export default Play;