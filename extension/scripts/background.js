// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict'

let url_base = 'http://18.215.242.203:3000'

let fetchedData = []

const DATE_UNIX_TIME = (1566691200+86400) // unix time to start the count (segunda da semana 39)

let initWeek = 0

const INIT_WEEKDAY = 1 // monday

const SPRINT_LENGTH = 5 // 5 days - monday to friday

const FETCH_METRICS = 
[
  'commits', // 0 
  'issues', // 1
  'branches', // 2
  'pullrequests', // 3
  'ranking' // 4
]

const FETCH_PROFILE = 
[
  'profile'
]

async function fetchAPI()
{
  let url = 'https://api.github.com/repos/fga-eps-mds/2019.2-git-breakdown/stats/commit_activity'
  try
  {
    return (await fetch(url)).json()
  }
  catch (err)
  {
    console.log("erro na api commit data")
    console.log(err)
  }
}

/**
 * Retorna o UNIX TIME do domingo inicial da semana da data inicial que o usuário escolher
 * @param {*} weekday dia da semana escolhido pelo usuário 0 = domingo, 1 = segunda, ..., 6 = sábado
 * @param {*} time ao escolher nas configurações o dia inicial, este é transformado em UNIX TIME que é recebido aqui
 * como paramêtro
 */
function getInitUnixTime(weekday, time)
{
  // a gnt pega o tempo inicial da data que o usuario escolheu e acha o domingo da sua semana
  return (weekday === 0? time : (time - (weekday*86400)))
}

/**
 * Retorna a posição do vetor do JSON que contém a posição inicial
 * @param {*} data 
 * @param {*} initTime 
 */
function filterStartingWeek(data, initTime)
{
  for (let i = 0; i < data.length; i++)
  {
    if (i > 0)
      console.log(data[i].week - data[i-1].week)
    if (initTime === undefined && data[i].total > 0)
      return i // se nenhuma semana inicial é definida, começamos da primeira com commits

    if (data[i].week === initTime)
      return i
    else if (data[i].week > initTime)
    {
      if (data[i-1].week < initTime) 
        return (i-1) // se o tempo inicial definido não é de um domingo pegamos do domingo que iniciou a semana
    }
  }
  return 0
}

async function fetchData(type, aux)
{
    let url_fetch = `${url_base}/${type}/${aux}`
    try
    {
      return (await fetch(url_fetch)).json()
    }
    catch (err)
    {
      console.log('Error: URL = ', url_fetch, ' err: ', err)
    }
}

async function execute(request, aux)
{
  try {
    const data_ = await Promise.all(FETCH_METRICS.map(type => fetchData(type, aux)))

    const time_info = await fetchAPI()
    console.log(time_info)

    // se DATE_UNIX_TIME n for domingo, transforma no unix time do domingo daquela semana
    let initUnixTime = getInitUnixTime(INIT_WEEKDAY, DATE_UNIX_TIME) 

    initWeek = filterStartingWeek(time_info, initUnixTime)

    console.log("initial week is: " + initWeek)

    data_[0] = removeDuplicates(data_[0])
    data_[4] = removeDuplicates(data_[4])

    console.log(data_[0])
    console.log(data_[4])

    fetchedData = data_
    fetchedData[5] = aux

    return data_
    
  } catch(err){
    console.log("GBD error at background.js\nAt execute():", err)
  }
}

function removeDuplicates(data)
{
  let array = data
  let seenNames = {}

  array = array.filter(function(curr)
  {
    if (curr.name in seenNames)
    {
      return false
    }
    else
    {
      seenNames[curr.name] = true
      return true
    }
  })

  return array
}

async function executeProfile(request, aux)
{
  try {
    console.log("executing profile")
    const data_ = await Promise.all(FETCH_PROFILE.map(type => fetchData(type, aux)))
    fetchedData = data_
    fetchedData[5] = aux
    return data_
  } catch(err){
    console.log("GBD error at background.js\nAt execute():", err)
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    let weights = request.metric
    chrome.storage.sync.get('oauth2_token', (res) =>
    {
        if (res.oauth2_token != undefined)
        {
            chrome.tabs.query
            ({
                'active': true, 'lastFocusedWindow': true
            },
            function (tabs) 
            {
                if (tabs[0] != undefined)
                {
                  try{
                    let url = tabs[0].url.split("/")
                    let owner = url[3]
                    let repo = url[4].split("#")[0]
                    let url_aux = 
                    `?owner=${owner}&repository=${repo}&token=${res.oauth2_token}&commits=${weights[0]}&merged=${weights[1]}&openissues=${weights[2]}&commentpr=${weights[3]}`
                    if (request.getProfile)
                    {
                      console.log("fetching profile")
                      url_aux = 
                      `?owner=${request.profile}&repository=${repo}&token=${res.oauth2_token}`
                      executeProfile(request, url_aux).then(sendResponse)
                    }
                    else
                    {
                      console.log("not fetching profile")
                      if (fetchedData.length > 0 && fetchedData[0] != undefined &&
                        fetchedData[5] == url_aux)
                      {
                        console.log("returning fetched data")
                        sendResponse(fetchedData)
                      }
                      else
                      {
                        if (fetchedData.length > 0 && fetchedData[0] != undefined && fetchedData[5] != url_aux)
                          console.log("updating data")

                        console.log("fetching data")
                        execute(request, url_aux).then(sendResponse)
                      }
                    }
                  } catch (err) {
                      console.log("GBD erro at background.js\nAt chrome.runtime.onMessage.addListener\n At function(tab):", err)
                    }
                }
            })
        }
    })
    return true
})


chrome.runtime.onInstalled.addListener(function() 
{
})


chrome.declarativeContent.onPageChanged.removeRules(undefined, function() 
{
  chrome.declarativeContent.onPageChanged.addRules([
  {
    conditions: [new chrome.declarativeContent.PageStateMatcher(
    {
      pageUrl: {hostEquals: 'developer.chrome.com'},
    })
    ],
        actions: [new chrome.declarativeContent.ShowPageAction()]
  }])
})


