import React, { Component } from 'react';
import { Button, Grid, List, Image, Table, Divider, Icon } from 'semantic-ui-react'
import Loading from './Loading';
import ParsecLogo from '../img/parsec_logo.svg'
import DiscordIcon from '../img/discord_icon.svg'

const { ipcRenderer } = window.require('electron');

let stateTimeout;

class Play extends Component {

	constructor() {

		super();

		this.state = {
			isLoading: true,
			immediateIsStarting: false,
			immediateIsStopping: false,
			errorMessage: "",
			cloudRIGState: {
				activeInstance: null,
				instanceReady: false,
				instanceStopping: false,
				scheduledStop: null,
				currentSpotPrice: null,
				remainingTime: null
			}
		}

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
			
			this.setState({
				cloudRIGState: state
			})

			ipcRenderer.send('cmd', 'disableNonPlay', 
				this.state.immediateIsStarting || 
				this.state.immediateIsStopping ||
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

		if(this.state.cloudRIGState.instanceReady || this.state.cloudRIGState.instanceStopping) {
			
			if(!this.state.cloudRIGState.instanceStopping && !this.state.immediateIsStopping) {
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
			
			if(!this.state.cloudRIGState.instanceReady) {

				if(!this.state.cloudRIGState.activeInstance && !this.state.immediateIsStarting) {
					actionButtons = <Button content='Start' icon='play' labelPosition='right' onClick={this.start.bind(this)} />
				} else {
					actionButtons = <Button content='Starting...' icon='play' labelPosition='right' disabled />
				}

			}

		}

		if(this.state.isLoading) {

			return(<Loading message="Setting up" />)

		} else {

			const readyCell = this.state.cloudRIGState.instanceReady ? <Icon name='circle' color='green' /> : '-'

			const stoppingCell = this.state.cloudRIGState.instanceStopping ? <Icon name='circle' color='red' /> : '-'

			const remainingCell = this.state.cloudRIGState.scheduledStop ? this.state.cloudRIGState.remainingTime : '-'

			const spotCell = this.state.cloudRIGState.currentSpotPrice;

			return(

				<Grid>
					<Grid.Row>
						<Grid.Column width={10}>
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
										<Table.Cell>Ready</Table.Cell>
										<Table.Cell>{readyCell}</Table.Cell>
									</Table.Row>
									<Table.Row>
										<Table.Cell>Stopping</Table.Cell>
										<Table.Cell>{stoppingCell}</Table.Cell>
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

						</Grid.Column>

					</Grid.Row>

				</Grid>

			)
		}

		

	}

}

export default Play;