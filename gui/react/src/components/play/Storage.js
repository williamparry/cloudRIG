import React, { Component } from 'react';
import { Button, Form, Message, Table, Header, Icon, Input, Divider, Grid } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';

class Storage extends Component {

	constructor(props) {
		super(props)
		this.state = {...props, newVolume: 100, transferNum: 0,  maxVolumeSize: 1000}

	}

	componentWillReceiveProps(newProps) {
		this.setState({
			...this.state,
			...newProps
		})
	}

	handleChange(e, data) {
		this.setState({
			newVolume: data.value
		})
	}

	handleAZChange(e, data) {
		this.setState({
			transferNum: data.value
		})
	}

	submit() {
		this.state.handleSubmit(this.state.newVolume)
	}

	delete() {
		this.state.handleDelete(this.state.volumesInAZ[0])
	}

	transfer() {
		this.state.handleTransfer(this.state.volumesNotInAZ[this.state.transferNum])
	}

	expand(){
		this.state.handleExpand(this.state.volumesInAZ[0], this.state.newVolumeSize)
	}

	onChangeVolumeSize(event){
		if(event && event.target){
			const newValue = event.target.value>this.state.maxVolumeSize ? this.state.maxVolumeSize : event.target.value;
			this.setState({newVolumeSize:newValue});
		}
	}

	render() {
		
		const message = this.state.volumesNotInAZ.length > 0 ? <Message warning icon='exclamation triangle' header='You have a volume in another Availability Zone' content='You will still be charged for it if you create another one here.' /> : ''
		const buttons = this.state.volumesInAZ.length > 0 ?
			(
				<div>
					<Form>
						<Form.Group inline>
							<Button content='Delete volume' icon='delete' labelPosition='right' onClick={this.delete.bind(this)} />
						</Form.Group>
						{this.state.volumesInAZ[0].Size < this.state.maxVolumeSize && 
						<div>
						<Form.Group inline>
							<Button content='Expand volume' icon='expand' labelPosition='right' onClick={this.expand.bind(this)} disabled={!this.state.newVolumeSize || this.state.newVolumeSize<=this.state.volumesInAZ[0].Size } />
							<Form.Field>
								<Input type="number" min="100" max="1000" labelPosition="right" label="GB" value={this.state.newVolumeSize ? this.state.newVolumeSize : this.state.volumesInAZ[0].Size} onChange={this.onChangeVolumeSize.bind(this)} />
							</Form.Field>
						</Form.Group>{
							this.state.newVolumeSize<this.state.volumesInAZ[0].Size &&
						<Message negative>
								<p>Min volume new size is { this.state.volumesInAZ[0].Size + 1} GB</p>  
							</Message>
							}
							</div>}
					</Form>
				</div>)
			:
			(
				<Form>
					<Form.Group widths='equal'>
						<Grid container columns={2}>
							<Grid.Row>
								<Grid.Column>
									<Form.Select label='Create Volume With Size' value={this.state.newVolume} onChange={this.handleChange.bind(this)} options={ [
										{ key: '50', text: '50 GB', value: 50 },
										{ key: '100', text: '100 GB', value: 100 },
										{ key: '150', text: '150 GB', value: 150 },
										{ key: '200', text: '200 GB', value: 200 },
									]} />
								</Grid.Column>
								<Grid.Column verticalAlign="bottom">
									<Button onClick={this.submit.bind(this)}>Create</Button>
								</Grid.Column>
							</Grid.Row>
						</Grid>
					</Form.Group>
					{this.state.volumesNotInAZ.length > 0 && this.state.volumesInAZ.length===0 ?
					<React.Fragment>
						<Divider horizontal>Or</Divider>
						<Form.Group  widths='equal'>
							<Grid container columns={2}>
								<Grid.Row>
									<Grid.Column>
										<Form.Select label='Transfer From Availability Zone' value={this.state.transferNum} onChange={this.handleAZChange.bind(this)} options={ 
											this.state.volumesNotInAZ.map((volume, index, array) => {
												return { key: index, text: volume.AvailabilityZone, value: index }
											})
										}
										/>
									</Grid.Column>
									<Grid.Column verticalAlign="bottom">
										<Button content='Transfer Here' icon='exchange' labelPosition='right' onClick={this.transfer.bind(this)} /> 
									</Grid.Column>
								</Grid.Row>
							</Grid>
						</Form.Group>
						<small><Icon name='info circle' fitted /> This will take a long time, and will delete the volume in the previous Availability Zone.</small>
					 </React.Fragment> : '' }
				</Form>
			);
		

		return(
			
			<React.Fragment>
				
				{message}
				{buttons}

				<Header>Prices</Header>
				<Table definition>
					<Table.Body>
						<Table.Row>
							<Table.Cell><small>Default cloudRIG Drive 30GB</small></Table.Cell>
							<Table.Cell><small>approx.</small> $1.60/month</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell><small>Extra Volume (persistent volume)<sup>*</sup></small></Table.Cell>
							<Table.Cell>
								<small>approx.</small> $11.90/month for 100GB
							</Table.Cell>
						</Table.Row>
						
					</Table.Body>
				</Table>	
					
				<small>
					<sup>*</sup>You are only charged for how much you use, and it is tied to one Availability Zone.&nbsp;
					<a href='https://aws.amazon.com/ebs/pricing/' target='_blank' rel='noopener noreferrer'>Detailed pricing <Icon name='external' /></a>
				</small>
			</React.Fragment>
		  )

	}

}

export default Storage;