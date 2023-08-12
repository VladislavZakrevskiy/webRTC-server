const path = require('path')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const ACTIONS = require('./actions')
const {version, validate} = require('uuid')

const PORT = process.env.PORT || 5000

io.on('connection', socket => {
    broadcastRooms()

    socket.on(ACTIONS.JOIN, config => {
        const {room: roomId} = config
        const {rooms: joinedRooms} = socket
        if(Array.from(joinedRooms).includes(roomId)) {
            return console.log('Already joined to ' + roomId)
        }

        const clients = Array.from (io.sockets.adapter.rooms.get(roomId) || [])

        clients.forEach(clientId => {
            io.to(clientId).emit(ACTIONS.ADD_PEER, {
                peerID: socket.id,
                createOffer: false
            })
            socket.emit(ACTIONS.ADD_PEER, {
                peerID: clientId,
                createOffer: true
            })
        })

        socket.join(roomId)
        broadcastRooms()
    })

    const leaveRoom = () => {
        const {rooms} = socket
        Array.from(rooms)
        .filter(roomID => validate(roomID) && version(roomID) === 4)
        .forEach(roomsId => {
            const clients = Array.from(io.sockets.adapter.rooms.get(roomsId) || [])
    
            clients.forEach(clientId => {
                io.to(clientId).emit(ACTIONS.REMOVE_PEER, {
                    peerID: socket.id
                })
            
                socket.emit(ACTIONS.REMOVE_PEER, {
                   peerID: clientId 
                })
            })
    
            socket.leave(roomsId)
        })
    
        broadcastRooms()
    }
    
    socket.on(ACTIONS.LEAVE, leaveRoom)
    socket.on('disconnecting', leaveRoom)

    socket.on(ACTIONS.RELAY_SDP, ({peerID, sessionDescription}) => {
        io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
            peerID: socket.id,
            sessionDescription
        })
    })

    socket.on(ACTIONS.RELAY_ICE, ({peerID, iceCandidate}) => {
        io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
            peerID: socket.id,
            iceCandidate
        })
    })
})



const getClientRooms = () => {
    const {rooms} = io.sockets.adapter
    return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4)
}

const broadcastRooms = () => {
    io.emit(ACTIONS.SHARE_ROOMS, {
        rooms: getClientRooms()
    })
}

server.listen(PORT, () => console.log(`server starts in port ${PORT}`))
