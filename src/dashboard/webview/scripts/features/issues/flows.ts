export const ISSUE_FLOWS_SCRIPT = `
    function availableIssueFlows(issue) {
      if (issue.flows?.length) {
        return issue.flows;
      }
      if (issue.secondaryLocations?.length) {
        return [{ index: 0, locations: issue.secondaryLocations }];
      }
      return [];
    }

    function issueFlowRoleLabel(role) {
      if (role === 'source') return 'Source';
      if (role === 'sink') return 'Sink';
      if (role === 'intermediate') return 'Paso intermedio';
      return 'Ubicación relacionada';
    }

    function selectIssueFlowLocation(issue, locationIndex) {
      selectedFlowLocationIndex = locationIndex;
      renderIssueFlows(issue);
      vscode.postMessage({
        type: 'selectFlowLocation',
        issueKey: issue.key,
        flowIndex: selectedFlowIndex,
        locationIndex
      });
    }

    function renderIssueFlows(issue) {
      const flows = availableIssueFlows(issue);
      elements.issueFlowSection.hidden = flows.length === 0;
      elements.issueFlowSelect.textContent = '';

      if (!flows.length) {
        return;
      }

      selectedFlowIndex = Math.min(selectedFlowIndex, flows.length - 1);

      flows.forEach((flow, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent =
          'Flujo ' +
          String(index + 1) +
          ' · ' +
          String(flow.locations.length) +
          ' ubicaciones';
        elements.issueFlowSelect.appendChild(option);
      });

      elements.issueFlowSelect.value = String(selectedFlowIndex);
      const locations = flows[selectedFlowIndex].locations || [];
      selectedFlowLocationIndex = Math.min(
        selectedFlowLocationIndex,
        Math.max(0, locations.length - 1)
      );
      elements.issueFlowLocations.textContent = '';

      locations.forEach((location, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          'flow-location' +
          (index === selectedFlowLocationIndex ? ' active' : '');

        const role = document.createElement('strong');
        role.textContent = issueFlowRoleLabel(location.role);

        const path = document.createElement('span');
        path.textContent =
          location.relativePath +
          ':' +
          location.line +
          (location.resolved ? '' : ' · No disponible localmente');

        const message = document.createElement('small');
        message.textContent = location.message || '';

        button.append(role, path, message);
        button.addEventListener('click', () => {
          selectIssueFlowLocation(issue, index);
        });

        item.appendChild(button);
        elements.issueFlowLocations.appendChild(item);
      });
    }
`;
