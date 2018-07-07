import React, { Component } from 'react';
import { Form, Grid, Select, Button, Confirm, Popup, Image, Modal } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import AWSProfile from './configuration/AWSProfile.js';
const { ipcRenderer } = window.require('electron');

let instanceTypes;
let allRegions;
let allZones;

class Configuration extends Component {

	constructor(props) {

		super(props)

		const config = ipcRenderer.sendSync('cmd', 'getConfiguration');
		const credentials = ipcRenderer.sendSync('cmd', 'getCredentials');
		const zonesArr = ipcRenderer.sendSync('cmd', 'getZones');
		const instanceTypesArr = ipcRenderer.sendSync('cmd', 'getInstanceTypes')

		allRegions = [];
		allZones = [];

		Object.keys(zonesArr).forEach((region) => {

			allRegions.push({ key: region, text: region, value: region })

			zonesArr[region].forEach((zone) => {
				let z = region + zone
				allZones.push({ key: z, text: z, value: z })
			})

		});

		instanceTypes = instanceTypesArr.map((instanceType) => ({ key: instanceType, text: instanceType, value: instanceType }))
		
		const profiles = this.extractProfileCredentials(credentials);

		this.state = {
			currentZones: this.getZones(config.AWSRegion),
			profiles: profiles,
			addCredentialsOpen: false,
			editCredentialsOpen: false,
			confirmRemoveModalOpen: false,
			config: config,
			allCredentials: credentials,
			currentCredentials: config.AWSCredentialsProfile ? this.getCurrentCredentials(credentials, profiles, config.AWSCredentialsProfile) : {}
		}

	}


	saveConfiguration() {
		ipcRenderer.send('cmd', 'saveConfiguration', this.state.config);
	}

	extractProfileCredentials(credentials) {

		if (!credentials) {
			return [];
		}

		return credentials.match(/\[(.*?)\]/g).map((profile) => {
			return profile.substring(1, profile.length - 1)
		})

	}

	handleChange(e, data) {
		// If you are using babel, you can use ES 6 dictionary syntax { [e.target.name] = e.target.value }
		var change = {
			config: { ...this.state.config }
		}
		change['config'][data.name] = data.value
		this.setState(change)
	}

	handleCredentialsProfileChange(e, data) {

		this.setCurrentCredentials(data.value);
		this.handleChange(e, data);

	}

	getCurrentCredentials(credentials, profiles, profile) {
		var bounds = this.getCredentialsBounds(credentials, profiles, profile);

		var creds = credentials.substring(bounds.startIndex, bounds.endIndex)
			.trim()
			.split('\n')
			.map(c => { return c.split('=')[1].trim() })

		return {
			profile: profile,
			aws_access_key_id: creds[0],
			aws_secret_access_key: creds[1]
		}

	}

	setCurrentCredentials(profile) {

		this.setState({
			currentCredentials: this.getCurrentCredentials(this.state.allCredentials, this.state.profiles, profile)
		})

	}

	getCredentialsBounds(allCredentials, profiles, profile) {

		const startIndex = allCredentials.indexOf('[' + profile + ']') + (profile.length + 2)
		const nextProfile = profiles[profiles.indexOf(profile) + 1]
		const endIndex = nextProfile ? allCredentials.indexOf('[' + nextProfile + ']') : allCredentials.length

		// TODO: Investigate ES sugar
		return {
			startIndex: startIndex,
			endIndex: endIndex
		}
	}

	handleCredentialsEdit(credentialsObject) {
		//console.log(credentialsObject)

		let credentialsFile = this.state.allCredentials;

		var bounds = this.getCredentialsBounds(this.state.allCredentials, this.state.profiles, this.state.config.AWSCredentialsProfile)

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

		let credentialsFile = this.state.allCredentials;

		var bounds = this.getCredentialsBounds(this.state.allCredentials, this.state.profiles, this.state.config.AWSCredentialsProfile)

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

	getZones(region) {

		return allZones.filter(zone => {
			return zone.key.indexOf(region) >= 0
		});

	}

	handleRegionChange(e, data) {

		const currentZones = this.getZones(data.value);

		this.setState({
			currentZones: currentZones
		});

		setTimeout(() => {

			var newConfig = { ...this.state.config }
			newConfig.AWSAvailabilityZone = currentZones[0].key;

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

	openConfirmRemoveModal() {
		this.setState({
			confirmRemoveModalOpen: true
		})
	}

	handleCancelRemoveModal() {
		this.setState({
			confirmRemoveModalOpen: false
		})
	}

	render() {

		return (

			<div>

				<Confirm
					content={`Are you sure you wish to delete AWS Profile: "${this.state.config.AWSCredentialsProfile}"?`}
					open={this.state.confirmRemoveModalOpen}
					onCancel={this.handleCancelRemoveModal.bind(this)}
					onConfirm={this.handleCredentialsDelete.bind(this)}
				/>
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
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile })} handleSubmit={this.handleCredentialsAdd.bind(this)} />
										</Modal.Description>
									</Modal.Content>
								</Modal>
								<Modal open={this.state.editCredentialsOpen} onClose={this.editCredentialsClose.bind(this)} closeIcon trigger={<Button onClick={this.editCredentialsOpen.bind(this)} content='Edit' icon='edit' labelPosition='left' disabled={!this.state.config.AWSCredentialsProfile} />}>
									<Modal.Header>Edit AWS Profile</Modal.Header>
									<Modal.Content>
										<Modal.Description>
											<AWSProfile disallowedProfileNames={this.state.profiles.filter(p => { return p !== this.state.config.AWSCredentialsProfile })} currentCredentials={this.state.currentCredentials} handleSubmit={this.handleCredentialsEdit.bind(this)} />
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
									options={allRegions}
									value={this.state.config.AWSRegion}
									name="AWSRegion"
									onChange={this.handleRegionChange.bind(this)}
									placeholder="- Select -"
									required />
							</Grid.Column>
							<Grid.Column width={8}>
								<Form.Field control={Select}
									label='AWS Availability Zone'
									options={this.state.currentZones}
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
							<Grid.Column width={5}>
								<Popup
									trigger={<Form.Field control={Select}
									label='AWS Instance Type'
									options={instanceTypes}
									value={this.state.config.AWSInstanceType}
									name="AWSInstanceType"
									onChange={this.handleChange.bind(this)}
									placeholder="- Select -"
									required />}
								hoverable={true}
								on='focus'
								position='top left'>
									<Popup.Header>What's the difference?</Popup.Header>
									<Popup.Content>
										<ul>
											<li>g2.2xlarge is cheaper and probably fine for most games</li>
											<li>g3.4xlarge is more expensive, but more powerful</li>
										</ul>
									</Popup.Content>
								</Popup>
							</Grid.Column>
							
							<Grid.Column width={8}>
								<Popup
									trigger={<Form.Input type="password" label='Parsec Server Id'
										value={this.state.config.ParsecServerId}
										name="ParsecServerId"
										onChange={this.handleChange.bind(this)}
										placeholder='server_id'
										required />}
									hoverable={true}
									on='focus'
									size='small'
									position='bottom left'>
									<Popup.Header>Where can I find my server_id?</Popup.Header>
									<Popup.Content>
										<ol>
											<li>Make a Parsec account</li>
											<li>Download the Parsec client</li>
											<li><a href="https://parsecgaming.com/add-computer/own" rel="noopener noreferrer" target="_blank">Get the self-hosting key</a></li>
										</ol>

										<Image
											src='https://user-images.githubusercontent.com/348091/32673294-ef117400-c64e-11e7-949f-a34344b1368e.jpg'
											as='a'
											size='tiny'
											href='https://user-images.githubusercontent.com/348091/32673294-ef117400-c64e-11e7-949f-a34344b1368e.jpg'
											target='_blank' />

									</Popup.Content>
								</Popup>


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