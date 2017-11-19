import React, { Component } from 'react';
import { Button, Message, Grid, List, Image, Table, Divider } from 'semantic-ui-react'
import Loading from './Loading';
import ParsecLogo from '../img/parsec_logo.svg'
import DiscordIcon from '../img/discord_icon.svg'

const { ipcRenderer } = window.require('electron');

let stateTimer;

class Play extends Component {

	constructor() {

		super();

		this.state = {
			isLoading: true,
			isStarting: false,
			isStopping: false,
			errorMessage: "",
			cloudRIGState: {
				startingInstances: [],
				activeInstances: [],
				pendingInstances: [],
				shuttingDownInstances: [],
				stoppedInstances: []
			}
		}

		ipcRenderer.on('starting', (event, isStarting) => {
			this.setState({
				isStarting: isStarting
			})
			ipcRenderer.send('cmd', 'disableNonPlay', true)
		})

		ipcRenderer.on('stopping', (event, isStopping) => {
			this.setState({
				isStopping: isStopping
			})
		})

		ipcRenderer.on('started', (event) => {
			ipcRenderer.send('cmd', 'getState')
		})

		ipcRenderer.on('stopped', (event) => {
			ipcRenderer.send('cmd', 'getState')
		})

		ipcRenderer.on('errorPlay', (event, err) => {

			this.setState({
				isStarting: false,
				hasStarted: false,
				errorMessage: err
			})

		});

		ipcRenderer.on('gotState', (event, state) => {
			
			if(state.activeInstances.length > 0) {
				ipcRenderer.send('cmd', 'disableNonPlay', true)
			} else {
				ipcRenderer.send('cmd', 'disableNonPlay', false)
			}

			this.setState({
				cloudRIGState: state
			})

		});

	}

	componentWillUnmount() {

		ipcRenderer.removeAllListeners('starting')
		ipcRenderer.removeAllListeners('stopped')
		ipcRenderer.removeAllListeners('started')
		ipcRenderer.removeAllListeners('gotState')

		clearInterval(stateTimer)
		
	}

	handleDismiss = () => {
		this.setState({
			errorMessage: ""
		})

	}

	start() {
		ipcRenderer.send('cmd', 'start')
	}

	stop() {
		ipcRenderer.send('cmd', 'stop')
	}

	componentDidMount() {

		this.setState({
			isLoading: true
		});

		stateTimer = setInterval(() => {
			ipcRenderer.send('cmd', 'getState')
		}, 10000)

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

		if(this.state.cloudRIGState.activeInstances.length > 0 && !this.state.isStarting) {
			
			if(!this.state.isStopping) {
				actionButtons = <div>
					<Button content='Stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} />
					<Button content='Schedule stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} disabled />
				</div>
			} else {
				actionButtons = <div>
					<Button content='Stopping' icon='stop' labelPosition='right' disabled />
					<Button content='Schedule stop' icon='stop' labelPosition='right' disabled />
				</div>
			}

		} else {
			
			if(!this.state.isStarting) {
				actionButtons = <Button content='Start' icon='play' labelPosition='right' onClick={this.start.bind(this)} />
			} else {
				actionButtons = <Button content='Starting...' icon='play' labelPosition='right' disabled />
			}

		}

		let message = ""

		if(this.state.errorMessage) {
			message = <Message
				onDismiss={this.handleDismiss.bind(this)}
				header='cloudRIG could not start'
				content={this.state.errorMessage}
			/>
		}

		if(this.state.isLoading) {

			return(<Loading message="Setting up" />)

		} else {

			return(

				<Grid>
					<Grid.Row>
						<Grid.Column width={10}>
							{message}
							{actionButtons}
							<br /><br />
							<Divider horizontal>Powered by</Divider>
							<br />
							<a href='https://parsecgaming.com' target='_blank' rel='noopener noreferrer'>
								<Image width="200" src={ParsecLogo} />
							</a>

						</Grid.Column>
						<Grid.Column width={6}>


							<Table definition>

								<Table.Body>
									<Table.Row>
										<Table.Cell>Current Spot Price</Table.Cell>
										<Table.Cell>-</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Scheduled Stop</Table.Cell>
										<Table.Cell>-</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Pending Instances</Table.Cell>
										<Table.Cell>-</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Active Instances</Table.Cell>
										<Table.Cell>-</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Stopping Instances</Table.Cell>
										<Table.Cell>-</Table.Cell>
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

						</Grid.Column>

					</Grid.Row>

				</Grid>

			)
		}

		

	}

}

export default Play;