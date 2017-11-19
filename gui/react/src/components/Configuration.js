import React, { Component } from 'react';
import { Form, Grid, Select, Button, Modal, Message, Confirm } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import AWSProfile from './configuration/AWSProfile.js';
const { ipcRenderer } = window.require('electron');

const zonesArr = {
	"eu-central-1": ['a', 'b'],
	"us-east-1": ['a','b','c','d','e'],
	"us-west-1": ['a', 'b', 'c'],
	"us-west-2": ['a', 'b', 'c'],
	"ap-southeast-1": ['a', 'b'],
	"ap-northeast-1": ['a', 'b', 'c'],
	"ap-southeast-2": ['a', 'b'],
	"sa-east-1": ['a', 'b'],
}

class Configuration extends Component {


	constructor(props) {

		super(props)

		this.state = {
			regions: [],
			allZones: [],
			zones: [],
			profiles: [],
			addCredentialsOpen: false,
			editCredentialsOpen: false,
			confirmRemoveModalOpen: false,
			errorConfig: false,
			config: {
				AWSCredentialsProfile: "",
				AWSRegion: "",
				AWSAvailabilityZone: "",
				AWSMaxPrice: "",
				ParsecServerId: ""
			},
			allCredentials: {},
			currentCredentials: {}
		}
		
		Object.keys(zonesArr).forEach((region) => {
			
			this.state.regions.push({ key: region, text: region, value: region })
		
			zonesArr[region].forEach((zone) => {
				let z = region + zone
				this.state.zones.push({ key: z, text: z, value: z })
			})

			this.state.allZones = [...this.state.zones]
			
		});

		ipcRenderer.on('cmd', (event, arg) => {
			switch(arg) {
				case 'errorConfig':
				this.setState({
					errorConfig: true
				})
				break;
				default:

				break;
			}
		})

	}

	saveConfiguration() {
		ipcRenderer.send('cmd', 'saveConfiguration', this.state.config);
	}

	extractProfileCredentials(credentials) {

		if(!credentials) {
			return [];
		}
		
		return credentials.match(/\[(.*?)\]/g).map((profile) => {
			return profile.substring(1, profile.length - 1)
		})

	}

	componentDidMount() {
		//const setupSteps = ipcRenderer.send('setup');
		//console.log(setupSteps)
		const credentials = ipcRenderer.sendSync('cmd', 'getCredentials');
		const config = ipcRenderer.sendSync('cmd', 'getConfiguration');

		this.setState({
			allCredentials: credentials,
			config: config,
			profiles: this.extractProfileCredentials(credentials)
		})

		setTimeout(() => {
			if(config.AWSCredentialsProfile) {
				this.setCurrentCredentials(config.AWSCredentialsProfile)
			}
		}, 0)

	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners('cmd')
	}

	handleChange(e, data) {
		// If you are using babel, you can use ES 6 dictionary syntax { [e.target.name] = e.target.value }
		var change = {
			config: {...this.state.config}
		}
		change['config'][data.name] = data.value
		this.setState(change)
	}

	handleCredentialsProfileChange(e, data) {

		this.setCurrentCredentials(data.value);
		this.handleChange(e, data);

	}

	setCurrentCredentials(profile) {
		
		var bounds = this.getCredentialsBounds(profile);

		var creds = this.state.allCredentials.substring(bounds.startIndex, bounds.endIndex)
			.trim()
			.split('\n')
			.map(c => { return c.split('=')[1].trim() })

		this.setState({
			currentCredentials: {
				profile: profile,
				aws_access_key_id: creds[0],
				aws_secret_access_key: creds[1]
			}
		})

	}

	getCredentialsBounds(profile) {
		
		const startIndex = this.state.allCredentials.indexOf('[' + profile + ']') + (profile.length + 2)
		const nextProfile = this.state.profiles[this.state.profiles.indexOf(profile) + 1]
		const endIndex = nextProfile ? this.state.allCredentials.indexOf('[' + nextProfile + ']') : this.state.allCredentials.length

		// TODO: Investigate ES sugar
		return {
			startIndex: startIndex,
			endIndex: endIndex
		}
	}

	handleCredentialsEdit(credentialsObject) {
		//console.log(credentialsObject)

		var bounds = this.getCredentialsBounds(this.state.config.AWSCredentialsProfile)

		let credentialsFile = this.state.allCredentials;

		let replaceStr = `\naws_access_key_id=${credentialsObject.aws_access_key_id}
aws_secret_access_key=${credentialsObject.aws_secret_access_key}\n`

		credentialsFile = credentialsFile.substring(0, bounds.startIndex) + replaceStr + credentialsFile.substring(bounds.endIndex);

		ipcRenderer.send('cmd', 'saveCredentialsFile', credentialsFile);

		var newState = {
			editCredentialsOpen: false,
			allCredentials: credentialsFile,
			currentCredentials: credentialsObject
		};

		this.setState(newState)

	}

	handleCredentialsDelete() {
		
		var bounds = this.getCredentialsBounds(this.state.config.AWSCredentialsProfile)

		let credentialsFile = this.state.allCredentials;

		credentialsFile = credentialsFile.substring(0, bounds.startIndex - (this.state.config.AWSCredentialsProfile.length + 2)) + credentialsFile.substring(bounds.endIndex);

		ipcRenderer.send('cmd', 'saveCredentialsFile', credentialsFile);

		var newState = {
			confirmRemoveModalOpen: false,
			allCredentials: credentialsFile,
			config: {
				...this.state.config,
				AWSCredentialsProfile: ""
			},
			profiles: this.extractProfileCredentials(credentialsFile),
			currentCredentials: {}
		};

		this.setState(newState)

	}

	handleCredentialsAdd(credentialsObject) {

		let credentialsFile = this.state.allCredentials;
		
		credentialsFile += `\n[${credentialsObject.profile}]
aws_access_key_id=${credentialsObject.aws_access_key_id}
aws_secret_access_key=${credentialsObject.aws_secret_access_key}`

		ipcRenderer.send('cmd', 'saveCredentialsFile', credentialsFile);

		var newState = {
			addCredentialsOpen: false,
			profiles: [...this.state.profiles, credentialsObject.profile],
			allCredentials: credentialsFile,
			config: {
				...this.state.config,
				AWSCredentialsProfile: credentialsObject.profile
			},
			currentCredentials: credentialsObject
		};

		this.setState(newState)
	}
	
	handleRegionChange(e, data) {
		
		var newZones = this.state.allZones.filter(zone => {
			return zone.key.indexOf(data.value) >= 0
		});

		this.setState({
			zones: newZones
		});

		setTimeout(() => {

			var newConfig = {...this.state.config}
			newConfig.AWSAvailabilityZone = newZones[0].key;
	
			this.setState({
				config: newConfig
			});

		}, 0);
		
		this.handleChange(e, data);
	}

	addCredentialsOpen() {
		this.setState({
			addCredentialsOpen: true
		})
	}

	addCredentialsClose() {
		this.setState({
			addCredentialsOpen: false
		})
	}

	editCredentialsOpen() {
		this.setState({
			editCredentialsOpen: true
		})
	}

	editCredentialsClose() {
		this.setState({
			editCredentialsOpen: false
		})
	}

	openConfirmRemoveModal () {
		this.setState({
			confirmRemoveModalOpen: true
		})
	}

	handleCancelRemoveModal () {
		this.setState({
			confirmRemoveModalOpen: false
		})
	}

	render() {

		return(

			<div>
				<Confirm
					content={`Are you sure you wish to delete AWS Profile: "${this.state.config.AWSCredentialsProfile}"?`}
					open={this.state.confirmRemoveModalOpen}
					onCancel={this.handleCancelRemoveModal.bind(this)}
					onConfirm={this.handleCredentialsDelete.bind(this)}
				/>
				<Message error
					hidden={!this.state.errorConfig}
					header='Validation Error'
					content='Invalid AWS credentials. Please check your configuration' />
				<Form>
					<Grid>
						<Grid.Row>
							<Grid.Column width={8}>
								<Form.Field control={Select} 
									label='AWS Profile' 
									options={this.state.profiles.map(profile => {
										return { key: profile, text: profile, value: profile }
									})} 
									value={this.state.config.AWSCredentialsProfile}
									disabled={this.state.profiles.length === 0}
									name="AWSCredentialsProfile"
									onChange={this.handleCredentialsProfileChange.bind(this)} 
									placeholder="- Select -"
									required />
							</Grid.Column>
							<Grid.Column width={8} textAlign="right" verticalAlign="bottom">
								<Modal open={this.state.addCredentialsOpen} onClose={this.addCredentialsClose.bind(this)} closeIcon trigger={<Button onClick={this.addCredentialsOpen.bind(this)} content='Add' icon='add user' labelPosition='left' />}>
									<Modal.Header>Add AWS Profile</Modal.Header>
									<Modal.Content>
										<Modal.Description>
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile} )} handleSubmit={this.handleCredentialsAdd.bind(this)} />
										</Modal.Description>
									</Modal.Content>
								</Modal>
								<Modal open={this.state.editCredentialsOpen} onClose={this.editCredentialsClose.bind(this)} closeIcon trigger={<Button onClick={this.editCredentialsOpen.bind(this)} content='Edit' icon='edit' labelPosition='left' disabled={!this.state.config.AWSCredentialsProfile} />}>
									<Modal.Header>Edit AWS Profile</Modal.Header>
									<Modal.Content>
										<Modal.Description>
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile} )} currentCredentials={this.state.currentCredentials} handleSubmit={this.handleCredentialsEdit.bind(this)} />
										</Modal.Description>
									</Modal.Content>
								</Modal>
								<Button onClick={this.openConfirmRemoveModal.bind(this)} content='Delete' icon='user delete' labelPosition='left' disabled={!this.state.config.AWSCredentialsProfile || this.state.profiles.length === 1} />
							</Grid.Column>
						</Grid.Row>
						<Grid.Row>
							<Grid.Column width={8}>
								<Form.Field control={Select} 
									label='AWS Region' 
									options={this.state.regions} 
									value={this.state.config.AWSRegion} 
									name="AWSRegion"
									onChange={this.handleRegionChange.bind(this)} 
									placeholder="- Select -" 
									required />
							</Grid.Column>
							<Grid.Column width={8}>
								<Form.Field control={Select} 
									label='AWS Availability Zone' 
									options={this.state.zones} 
									value={this.state.config.AWSAvailabilityZone} 
									name="AWSAvailabilityZone"
									onChange={this.handleChange.bind(this)} 
									placeholder="- Select -" 
									required />
							</Grid.Column>
						</Grid.Row>
						<Grid.Row>
							<Grid.Column width={3}>
								<Form.Input label='AWS Max Price' 
									value={this.state.config.AWSMaxPrice} 
									name="AWSMaxPrice"
									onChange={this.handleChange.bind(this)} 
									placeholder='0.5' 
									required />
							</Grid.Column>
							<Grid.Column width={13}>
								<Form.Input label='Parsec Server Id' 
									value={this.state.config.ParsecServerId} 
									name="ParsecServerId" 
									onChange={this.handleChange.bind(this)} 
									placeholder='server_id' 
									required />
							</Grid.Column>
						</Grid.Row>
						<Grid.Row>
							<Grid.Column textAlign="right">
								<Button type='submit' onClick={this.saveConfiguration.bind(this)}>Save and initialize</Button>
							</Grid.Column>
						</Grid.Row>

					</Grid>
						
				</Form>
				
			</div>
		)

	}

}

export default Configuration;