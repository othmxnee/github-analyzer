import axios from 'axios'

const API_URL = 'http://localhost:5000'

export const startRepoAnalysis = async (repoUrl, force = false) => {
  try {
    const response = await axios.post(`${API_URL}/analyze`, {
      repo_url: repoUrl,
      ...(force ? { force: true } : {}),
    })
    return response.data
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data
      if (errorData && errorData.error) {
        throw new Error(errorData.error)
      }
      throw new Error(`Server error: ${error.response.status}`)
    } else if (error.request) {
      throw new Error('Could not connect to the server. Please make sure the backend is running.')
    } else {
      throw error
    }
  }
}

export const getRepoAnalysisResult = async (repoUrl) => {
  try {
    const response = await axios.get(`${API_URL}/analyze/result`, {
      params: { repo_url: repoUrl }
    })
    return response.data
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data
      if (errorData && errorData.error) {
        throw new Error(errorData.error)
      }
      throw new Error(`Server error: ${error.response.status}`)
    } else if (error.request) {
      throw new Error('Could not connect to the server. Please make sure the backend is running.')
    } else {
      throw error
    }
  }
}

export const checkHealth = async () => {
  const response = await axios.get(`${API_URL}/health`)
  return response.data
}

export const getArchitecture = async (repoUrl) => {
  const response = await axios.get(`${API_URL}/architecture`, {
    params: repoUrl ? { repo_url: repoUrl } : {}
  })
  return response.data
}

export const getBusFactorSimulation = async (repoUrl) => {
  const response = await axios.get(`${API_URL}/busfactor/simulation`, {
    params: repoUrl ? { repo_url: repoUrl } : {}
  })
  return response.data
}

export const getProjectSummary = async (repoUrl) => {
  const response = await axios.get(`${API_URL}/project-summary`, {
    params: repoUrl ? { repo_url: repoUrl } : {}
  })
  return response.data
}
