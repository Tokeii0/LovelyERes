在 Rust 的 ssh2 库里，非阻塞模式是通过底层 libssh2 的 non-blocking 支持实现的。核心思路是：

把底层 TcpStream 设为非阻塞。

把 ssh2::Session 配置成非阻塞模式。

调用可能返回 WouldBlock 的方法时，要用事件循环（epoll/kqueue/poll/select 等）或手动 poll 来等待 socket 可读/可写，再重试。

使用步骤
1. 设置 TcpStream 为非阻塞
use std::net::TcpStream;
use std::io;
use ssh2::Session;

fn main() -> io::Result<()> {
    let tcp = TcpStream::connect("example.com:22")?;
    tcp.set_nonblocking(true)?; // 关键：非阻塞模式

    let mut sess = Session::new().unwrap();
    sess.set_blocking(false); // 让 libssh2 使用非阻塞

    sess.handshake(&tcp)?; // 可能返回 WouldBlock

    Ok(())
}

2. 处理 WouldBlock

大部分 ssh2 的方法（如 handshake、userauth_password、channel.read 等）在非阻塞模式下可能返回 Err(e)，其中 e.code() == ErrorCode::Session(-37)，会映射为 Rust 的 io::ErrorKind::WouldBlock。

用法示例：

use std::io::{self, Read, Write};
use ssh2::ErrorCode;

fn do_handshake(sess: &mut Session, tcp: &TcpStream) -> io::Result<()> {
    loop {
        match sess.handshake(tcp) {
            Ok(()) => return Ok(()),
            Err(ref e) if e.code() == ErrorCode::Session(-37) => {
                // WouldBlock，等待 socket 可读/可写
                std::thread::sleep(std::time::Duration::from_millis(10));
                continue;
            }
            Err(e) => return Err(io::Error::new(io::ErrorKind::Other, e)),
        }
    }
}

3. 用 poll 或事件循环

如果不想手动 sleep，可以配合系统调用：

use nix::poll::{poll, PollFd, PollFlags};

fn wait_for_socket(fd: RawFd, for_read: bool, timeout_ms: i32) -> io::Result<()> {
    let mut fds = [PollFd::new(fd, if for_read { PollFlags::POLLIN } else { PollFlags::POLLOUT })];
    poll(&mut fds, timeout_ms).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    Ok(())
}


这样可以等 socket 可读/可写再继续执行 SSH 操作。

4. 与 tokio 集成

如果你在 async 环境（Tokio）里，可以用 tokio::net::TcpStream，然后通过 into_std() 转成 std::net::TcpStream，设置非阻塞，再交给 ssh2::Session。
不过 ssh2 不是异步库，需要自己封装成 spawn_blocking 或者用 poll_readable/poll_writable 来模拟异步等待。

总结

tcp.set_nonblocking(true) + sess.set_blocking(false) 是关键。

非阻塞模式下，大多数操作要循环重试，直到不再返回 WouldBlock。

生产环境里通常要配合 poll/epoll 或 async runtime 来高效等待。