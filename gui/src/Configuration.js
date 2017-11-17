import React, { Component } from 'react';
import { Icon, Image, Segment, Step, Divider, TextArea, Form, Grid, Select, Button, Modal, Message } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import AWSProfile from './AWSProfile.js';
import './App.css';
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
			}
		})

	}

	saveConfiguration() {
		ipcRenderer.send('cmd', 'saveConfiguration', this.state.config);
	}

	componentDidMount() {
		//const setupSteps = ipcRenderer.send('setup');
		//console.log(setupSteps)
		const credentials = ipcRenderer.sendSync('cmd', 'getCredentials');
		const config = ipcRenderer.sendSync('cmd', 'getConfiguration');

		this.setState({
			allCredentials: credentials,
			config: config,
			profiles: credentials.match(/\[(.*?)\]/g).map((profile) => {
				return profile.substring(1, profile.length - 1)
			})
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
		
		const startIndex = this.state.allCredentials.indexOf('[' + profile + ']') + (profile.length + 2)
		const nextProfile = this.state.profiles[this.state.profiles.indexOf(profile) + 1]
		const endIndex = this.state.allCredentials.indexOf('[' + nextProfile + ']')

		var creds = this.state.allCredentials.substring(startIndex, nextProfile ? endIndex : this.state.allCredentials.length)
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

	handleCredentialsEdit(credentialsObject) {
		//console.log(credentialsObject)
	}

	handleCredentialsAdd(credentialsObject) {

		let credentialsFile = this.state.allCredentials;
		
		credentialsFile += `[${credentialsObject.profile}]
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

	render() {

		return(

			<div>
				
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
									<Modal.Header>Add user</Modal.Header>
									<Modal.Content>
										<Modal.Description>
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile} )} handleSubmit={this.handleCredentialsAdd.bind(this)} />
										</Modal.Description>
									</Modal.Content>
								</Modal>
								<Modal open={this.state.editCredentialsOpen} onClose={this.editCredentialsClose.bind(this)} closeIcon trigger={<Button onClick={this.editCredentialsOpen.bind(this)} content='Edit' icon='edit' labelPosition='left' disabled={!this.state.config.AWSCredentialsProfile} />}>
									<Modal.Header>Edit user</Modal.Header>
									<Modal.Content>
										<Modal.Description>
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile} )} currentCredentials={this.state.currentCredentials} handleSubmit={this.handleCredentialsEdit.bind(this)} />
										</Modal.Description>
									</Modal.Content>
								</Modal>
								<Button content='Remove' icon='user delete' labelPosition='left' disabled={!this.state.config.AWSCredentialsProfile} />
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