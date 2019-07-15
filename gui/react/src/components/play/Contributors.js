import React, { Component } from 'react';
import { List } from "semantic-ui-react";
import 'semantic-ui-css/semantic.min.css';

const { ipcRenderer } = window.require("electron");

class Contributors extends Component {

	constructor(props) {
		super(props)
		this.state = {...props}

		this.state.loading = true;
		ipcRenderer.send("cmd", "getContributors");
	}

	componentWillReceiveProps(newProps) {
		this.setState({
			...this.state,
			...newProps
		});
	}

	componentDidMount() {
		ipcRenderer.on("contributorList", (event, state) => {
			this.setState({
				loading: false,
				contributors: {
					content: state
				}
			});
		});

		ipcRenderer.on("contributorListError", (event, state) => {
			this.setState({
				loading: false,
				contributors: {
					error: state
				}
			});
		});
	}

	setFirstStateListener() {
		ipcRenderer.once("contributorList", (event, state) => {
			this.setState({
				isLoading: false,
				contributors: state
			});
		});
		ipcRenderer.once("contributorList", (event, state) => {
			this.setState({
				isLoading: false
			});
		});
	}

	render() {

		if (this.state.loading) {
			return(
				<p>Loading...</p>
			)
		}

		if (this.state.contributors && this.state.contributors.error) {
			return(
				<p>Error while loading contributors: {this.state.contributors.error.code}</p>
			)
		}

		return(

			<React.Fragment>
				{(this.state.contributors && this.state.contributors.content) && (
					<List>
						{this.state.contributors.content.map((contributor, index) => {
							return <List.Item key={index}>{contributor.login}</List.Item>
						})}
					</List>
				)}
				{(!this.state.contributors || !this.state.contributors.content) && (
					<p>No contributors</p>
				)}
			</React.Fragment>
		)
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("contributorList");
		ipcRenderer.removeAllListeners("contributorListError");
	}
}

export default Contributors;
