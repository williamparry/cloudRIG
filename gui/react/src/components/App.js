import React, { Component } from 'react';
import { Icon, Segment, Container, Step, Grid, Button, Form, Header, Divider, Modal, Message } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import './App.css';
import Configuration from './Configuration';
import Initialization from './Initialization';
import Play from './Play';

const { ipcRenderer } = window.require('electron');

const pages = { "Configuration": 1, "Initialization": 2, "Play": 3, "Loading": 4 }

class App extends Component {

	state = {
		isPossessive: false,
		currentPage: pages.Loading,
		config: {},
		updateTriggered: false,
		updateAvailable: false,
		updateDownloading: false,
		updateDownloadData: {
			percent: 0
		},
		disableNonStartPages: false,
		logOutput: ["Welcome :)"]
	}

	constructor() {

		super();

		ipcRenderer.on('getConfigurationValidity', (event, valid) => {
			if(valid) {
				ipcRenderer.sendSync('cmd', 'setConfiguration');
				this.setState({
					currentPage: pages.Initialization
				});
				event.sender.send('cmd', 'log', '✓ Configured')
				return;		
			}
			this.setState({
				currentPage: pages.Configuration
			})
		})

		ipcRenderer.on('updateCheck', (event, updateAvailable) => {
			this.setState({
				updateAvailable: updateAvailable
			})
		})

		ipcRenderer.on('updateReady', (event) => {
			ipcRenderer.send('cmd', 'doUpdate');
		});

		ipcRenderer.on('updateDownloading', (event) => {
			this.setState({
				updateDownloading: true
			})
		});

		ipcRenderer.on('updateDownloadProgress', (event, data) => {
			this.setState({
				updateDownloadData: data
			})
		});

		ipcRenderer.on('setupValid', (event, valid) => {
			this.setState({
				currentPage: pages.Play
			})
			event.sender.send('cmd', 'log', '✓ Initialized')
		})

		ipcRenderer.on('disableNonPlay', (event, isRunning) => {
			this.setState({
				disableNonStartPages: isRunning
			})
		})

		ipcRenderer.on('changePage', (event, newPage) => {
			this.setState({
				currentPage: newPage
			})
		})
		
		ipcRenderer.on('log', (event, arg) => {
			this.setState({
				logOutput: [...this.state.logOutput, typeof arg === "string" ? arg : JSON.stringify(arg, null, 4)]
			})
			setTimeout(() => {
				var objDiv = document.getElementById("output");
				if(objDiv) {
					objDiv.scrollTop = objDiv.scrollHeight;
				}
			})
		})

		ipcRenderer.on('error', (event, arg) => {
			ipcRenderer.send('cmd', 'error', 'Sorry, there was an error, see log below.');
			this.setState({
				isPossessive: false
			})
			event.sender.send('cmd', 'log', arg)
		})

		ipcRenderer.on('possessiveStarted', (event, arg) => {
			this.setState({
				isPossessive: true
			})
		})

		ipcRenderer.on('possessiveFinished', (event, arg) => {
			this.setState({
				isPossessive: false
			})
		})

		ipcRenderer.on('credentialsFileChosen', (event, filePaths) => {
			if(filePaths) {
				var newConfig = {...this.state.config, AWSCredentialsFile: filePaths[0]}
				ipcRenderer.send('cmd', 'saveInitialConfiguration', newConfig);
			} else {
				ipcRenderer.send('cmd', 'error', 'You have to select an AWS credentials file or have a test account to use cloudRIG');
			}
		});

		ipcRenderer.on('savedInitialConfiguration', (event, config) => {
			this.setState({
				config: config
			});
		});
		
		const config = ipcRenderer.sendSync('cmd', 'getConfiguration');

		if(config.AWSCredentialsFile) {	
			ipcRenderer.sendSync('cmd', 'setConfiguration');
			ipcRenderer.send('cmd', 'getConfigurationValidity');
		}

		this.state.config = config

		setTimeout(function() {
			ipcRenderer.send('cmd', 'checkForUpdates');
		}, 2000)
		
	}

	changePage(e) {
		this.setState({
			currentPage: e
		})
	}

	handleChoose(e) {
		ipcRenderer.send('cmd', 'selectCredentialsFile');
	}

	triggerUpdate(event, config) {
		this.setState({
			updateTriggered: true,
			logOutput: ['Starting update']
		})
		ipcRenderer.send('cmd', 'preUpdate');
	};

	render() {
		
		const currentPage = 
			this.state.currentPage === pages.Configuration ? <Configuration /> : 
			this.state.currentPage === pages.Initialization ? <Initialization /> :
			this.state.currentPage === pages.Play ? <Play /> : null

		if(this.state.updateTriggered && !this.state.updateDownloading) {

			return (<div>
				<Modal open={true}>
					<Modal.Header>Preparing update...</Modal.Header>
					<Modal.Content>
						<Modal.Description>
							<pre id='output' style={{ height: 300, overflowY: 'scroll', overflowX: 'hidden' }}>{this.state.logOutput.join("\n")}</pre>
						</Modal.Description>
					</Modal.Content>
				</Modal>
			</div>)

		} else if(this.state.updateTriggered && this.state.updateDownloading) {

			return (<div>
				<Modal open={true}>
					
					<Modal.Header>Downloading update...</Modal.Header>
					<Modal.Content>
						<Modal.Description>
							{Math.floor(this.state.updateDownloadData.percent)}%
						</Modal.Description>
					</Modal.Content>
				</Modal>
			</div>)

		} else if(!this.state.config.AWSCredentialsFile) {

			return (<div>
				<Modal open={true}>
					<Modal.Header>Welcome to cloudRIG <Icon name='smile' /></Modal.Header>
					<Modal.Content>	
						<Modal.Description>
							<Header>Choose your account type</Header>
							<Grid>
								<Grid.Row>
									<Grid.Column width={7}>
										<p>
											<i>I have my own <a href="http://docs.aws.amazon.com/ses/latest/DeveloperGuide/create-shared-credentials-file.html" rel="noopener noreferrer" target="_blank">AWS Credentials File</a>.</i>
										</p>
										<Button content='Choose' icon='download' labelPosition='right' size='large' onClick={this.handleChoose.bind(this)} />
									</Grid.Column>
									<Grid.Column width={2}>
										<Divider vertical>Or</Divider>
									</Grid.Column>
									<Grid.Column width={7}>
										<p>
											<i>I have a test account from <a href="https://cloudrig.io" rel="noopener noreferrer" target="_blank">cloudrig.io</a>.</i>
										</p>
										<Form>
											<Form.Input label='Redemption code' disabled placeholder='----- ----- ----- -----' />
										</Form>
									</Grid.Column>
								</Grid.Row>
							</Grid>
							<br /><br />
							<Header>NOTICE</Header>
							<p>
								<small>
									THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
								</small>
							</p>
						</Modal.Description>
					</Modal.Content>
				</Modal>
			</div>)

		} else {

			return (<Grid stretched className={this.state.isPossessive ? 'possessive' : ''}>
				<Grid.Row style={{height: 476}}>
					<Grid.Column>
						<Step.Group attached='top'>
							<Step link 
								active={this.state.currentPage === pages.Configuration} 
								onClick={this.changePage.bind(this, pages.Configuration)}
								disabled={this.state.disableNonStartPages}>
								<Icon name='configure' />
								<Step.Content>
									<Step.Title>Configure</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage === pages.Initialization} 
								onClick={this.changePage.bind(this, pages.Initialization)}
								disabled={this.state.currentPage === pages.Configuration || this.state.disableNonStartPages}>
								<Icon name='tasks' />
								<Step.Content>
									<Step.Title>Initialize</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage === pages.Play}
								disabled={this.state.currentPage === pages.Configuration || this.state.currentPage === pages.Initialization}>
								<Icon name='game' />
								<Step.Content>
								<Step.Title>Play</Step.Title>
								</Step.Content>
							</Step>
						</Step.Group>
						<Segment attached className="stretched-segment" basic>
							{currentPage}
						</Segment>
					</Grid.Column>
				</Grid.Row>
				<Grid.Row verticalAlign="bottom">
					<Grid.Column>
					{this.state.updateAvailable ? <Message icon 
						info size='tiny' 
						style={{
							position: 'absolute',
							top: '-3.4em',
							left: '0',
							width: '100%',
							paddingTop: '.5em',
							paddingBottom: '.5em'
						}}>
						<Icon name='download' /><Message.Content>New version available. <Button onClick={this.triggerUpdate.bind(this)} size='tiny'>Update</Button></Message.Content></Message> : ''}
						<Container>
							<pre id='output' style={{ height: 60, overflowY: 'scroll' }}>{this.state.logOutput.join("\n")}</pre>
						</Container>
					</Grid.Column>
					
				</Grid.Row>
			</Grid>);

		}
	}
}

export default App;
