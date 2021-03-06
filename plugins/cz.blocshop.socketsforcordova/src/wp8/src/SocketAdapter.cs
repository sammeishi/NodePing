﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace Blocshop.ScoketsForCordova
{
    public interface ISocketAdapter
    {
        Task Connect(String host, int port);
        Task Write(byte[] data);
        void ShutdownWrite();
        void Close();
        SocketAdapterOptions Options { set; }
        Action<byte[]> DataConsumer { set; }
        Action<bool> CloseEventHandler { set; }
        Action<Exception> ErrorHandler { set; }
    }


    public class SocketAdapter : ISocketAdapter
    {
        private const int InputStreamBufferSize = 16 * 1024;
        private readonly Socket socket;

        public Action<byte[]> DataConsumer { get; set; }
        public Action<bool> CloseEventHandler { get; set; }
        public Action<Exception> ErrorHandler { get; set; }
        public SocketAdapterOptions Options { get; set; }

        public SocketAdapter()
        {
            this.socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        }

        public async Task Connect(string host, int port)
        {
            var connectSocketAsyncEventArgs = new SocketAsyncEventArgs
            {
                RemoteEndPoint = new DnsEndPoint(host, port)
            };

            await this.socket.ConnectTaskAsync(connectSocketAsyncEventArgs);

            this.StartReadTask();
        }

        public async Task Write(byte[] data)
        {
            var socketAsyncEventArgs = new SocketAsyncEventArgs();
            socketAsyncEventArgs.SetBuffer(data, 0, data.Length);

            await this.socket.SendTaskAsync(socketAsyncEventArgs);
        }

        public void ShutdownWrite()
        {
            this.socket.Shutdown(SocketShutdown.Send);
        }

        public void Close()
        {
            this.CloseEventHandler(false);
            this.socket.Close();
        }

        private void StartReadTask()
        {
            Task.Factory.StartNew(() => this.RunRead());
        }

        private async Task RunRead()
        {
            bool hasError = false;
            try
            {
                await this.RunReadLoop();
            }
            catch (SocketException ex)
            {
                hasError = true;
                this.ErrorHandler(ex);
            }
            catch (Exception ex)
            {
            }
            finally
            {
                this.socket.Close();
                this.CloseEventHandler(hasError);
            }
        }

        private async Task RunReadLoop()
        {
            byte[] buffer = new byte[InputStreamBufferSize];
            int bytesRead = 0;
            do
            {
                var eventArgs = new SocketAsyncEventArgs();
                eventArgs.SetBuffer(buffer, 0, InputStreamBufferSize);

                await this.socket.ReceiveTaskAsync(eventArgs);

                bytesRead = eventArgs.BytesTransferred;

                byte[] data = new byte[bytesRead];
                Array.Copy(buffer, data, data.Length);
                this.DataConsumer(data);
            }
            while (bytesRead != 0);
        }
    }
}
